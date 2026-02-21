package proxy

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shigawire-dev/internal/control"
	"github.com/shigawire-dev/internal/models"
	"github.com/shigawire-dev/internal/store"
)

const (
	maxCapturedBodyBytes = 64 * 1024
)

type Listener struct {
	Addr            string
	DB              *sql.DB
	Rec             *control.RecordingState
	DefaultUpstream string
	server          *http.Server
}

type healthResponse struct {
	Ok   bool   `json:"ok"`
	Addr string `json:"addr"`
}

type upstreamCheckResponse struct {
	Ok         bool   `json:"ok"`
	ProjectId  string `json:"project_id,omitempty"`
	TargetURL  string `json:"target_url"`
	StatusCode int    `json:"status_code"`
	Error      string `json:"error,omitempty"`
}

func NewListenerFromEnv(db *sql.DB, rec *control.RecordingState) *Listener {
	proxyPort := os.Getenv("PROXY_PORT")
	if proxyPort == "" {
		proxyPort = "9090"
	}

	return &Listener{
		Addr:            ":" + proxyPort,
		DB:              db,
		Rec:             rec,
		DefaultUpstream: strings.TrimSpace(os.Getenv("DEFAULT_UPSTREAM_BASE_URL")),
	}
}

func (l *Listener) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", l.handleHealth)
	mux.HandleFunc("/upstream-check", l.handleUpstreamCheck)
	mux.HandleFunc("/", l.handleProxy)

	l.server = &http.Server{
		Addr:              l.Addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = l.server.Shutdown(shutdownCtx)
	}()

	err := l.server.ListenAndServe()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func (l *Listener) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{Ok: true, Addr: l.Addr})
}

func (l *Listener) handleUpstreamCheck(w http.ResponseWriter, r *http.Request) {
	projectID, _, upstreamBase, _, err := l.resolveUpstream(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, upstreamCheckResponse{
			Ok:        false,
			ProjectId: projectID,
			Error:     err.Error(),
		})
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstreamBase, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, upstreamCheckResponse{
			Ok:        false,
			ProjectId: projectID,
			TargetURL: upstreamBase,
			Error:     err.Error(),
		})
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, upstreamCheckResponse{
			Ok:        false,
			ProjectId: projectID,
			TargetURL: upstreamBase,
			Error:     err.Error(),
		})
		return
	}
	_ = resp.Body.Close()

	writeJSON(w, http.StatusOK, upstreamCheckResponse{
		Ok:         true,
		ProjectId:  projectID,
		TargetURL:  upstreamBase,
		StatusCode: resp.StatusCode,
	})
}

func (l *Listener) handleProxy(w http.ResponseWriter, r *http.Request) {
	projectID, sessionID, upstreamBase, shouldRecord, err := l.resolveUpstream(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	targetURL, err := buildUpstreamURL(upstreamBase, r.URL)
	if err != nil {
		http.Error(w, "invalid upstream url", http.StatusInternalServerError)
		return
	}

	reqBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}

	upReq, err := http.NewRequestWithContext(r.Context(), r.Method, targetURL, bytes.NewReader(reqBody))
	if err != nil {
		http.Error(w, "failed to create upstream request", http.StatusInternalServerError)
		return
	}

	copyHeaders(upReq.Header, r.Header)
	removeHopByHopHeaders(upReq.Header)

	startedAt := time.Now().UTC()

	client := &http.Client{Timeout: 30 * time.Second}
	upResp, err := client.Do(upReq)
	if err != nil {
		if shouldRecord {
			l.persistEvent(sessionID, startedAt, time.Now().UTC(), r, reqBody, 502, nil, nil, "upstream_error:"+err.Error())
		}
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
		return
	}
	defer upResp.Body.Close()

	respBody, err := io.ReadAll(upResp.Body)
	if err != nil {
		http.Error(w, "failed to read upstream response", http.StatusBadGateway)
		return
	}

	copyHeaders(w.Header(), upResp.Header)
	removeHopByHopHeaders(w.Header())
	w.WriteHeader(upResp.StatusCode)
	_, _ = w.Write(respBody)

	if shouldRecord {
		l.persistEvent(sessionID, startedAt, time.Now().UTC(), r, reqBody, upResp.StatusCode, upResp.Header, respBody, "")
	}

	_ = projectID
}

func (l *Listener) resolveUpstream(r *http.Request) (projectID, sessionID, upstreamBase string, shouldRecord bool, err error) {
	active, recProjectID, recSessionID := l.Rec.Get()
	if active {
		cfg, cfgErr := l.loadProjectConfig(recProjectID)
		if cfgErr != nil {
			l.Rec.Stop()
			return "", "", "", false, fmt.Errorf("invalid recording state was reset: %w", cfgErr)
		}
		return recProjectID, recSessionID, cfg.UpstreamBaseUrl(), true, nil
	}

	if l.DefaultUpstream != "" {
		return "", "", l.DefaultUpstream, false, nil
	}

	headerProjectID := strings.TrimSpace(r.Header.Get("X-Shigawire-Project-Id"))
	if headerProjectID != "" {
		cfg, cfgErr := l.loadProjectConfig(headerProjectID)
		if cfgErr != nil {
			return "", "", "", false, cfgErr
		}
		return headerProjectID, "", cfg.UpstreamBaseUrl(), false, nil
	}

	return "", "", "", false, errors.New("no upstream configured; set DEFAULT_UPSTREAM_BASE_URL or start recording for a session")
}

func (l *Listener) loadProjectConfig(projectID string) (*models.ProjectConfig, error) {
	p, err := store.GetProject(l.DB, projectID)
	if err != nil {
		return nil, fmt.Errorf("load project: %w", err)
	}
	if p == nil {
		return nil, fmt.Errorf("project not found: %s", projectID)
	}

	cfg, err := models.ParseProjectConfig(p.ConfigJSON)
	if err != nil {
		return nil, fmt.Errorf("parse project config: %w", err)
	}
	return cfg, nil
}

func (l *Listener) persistEvent(
	sessionID string,
	startedAt time.Time,
	endedAt time.Time,
	req *http.Request,
	reqBody []byte,
	statusCode int,
	respHeaders http.Header,
	respBody []byte,
	redactionNote string,
) {
	if sessionID == "" {
		return
	}

	e := &models.Event{
		Id:               "event_" + uuid.NewString(),
		SessionId:        sessionID,
		StartedAt:        startedAt.Format(time.RFC3339Nano),
		EndedAt:          endedAt.Format(time.RFC3339Nano),
		Method:           req.Method,
		URL:              req.URL.RequestURI(),
		Status:           statusCode,
		ReqHeaders:       marshalHeaders(req.Header),
		RespHeaders:      marshalHeaders(respHeaders),
		ReqBody:          truncateBytes(reqBody, maxCapturedBodyBytes),
		RespBody:         truncateBytes(respBody, maxCapturedBodyBytes),
		RedactionApplied: redactionNote,
	}

	if err := store.InsertEvent(l.DB, e); err != nil {
		log.Printf("proxy: failed to persist event: %v", err)
	}
}

func buildUpstreamURL(base string, incoming *url.URL) (string, error) {
	u, err := url.Parse(base)
	if err != nil {
		return "", err
	}

	basePath := strings.TrimRight(u.Path, "/")
	inPath := incoming.Path
	if inPath == "" {
		inPath = "/"
	}

	if strings.HasPrefix(inPath, "/") {
		u.Path = basePath + inPath
	} else {
		u.Path = basePath + "/" + inPath
	}

	u.RawQuery = incoming.RawQuery
	return u.String(), nil
}

func copyHeaders(dst, src http.Header) {
	for k, values := range src {
		for _, v := range values {
			dst.Add(k, v)
		}
	}
}

func removeHopByHopHeaders(h http.Header) {
	if c := h.Get("Connection"); c != "" {
		for _, token := range strings.Split(c, ",") {
			h.Del(strings.TrimSpace(token))
		}
	}

	h.Del("Connection")
	h.Del("Proxy-Connection")
	h.Del("Keep-Alive")
	h.Del("Proxy-Authenticate")
	h.Del("Proxy-Authorization")
	h.Del("Te")
	h.Del("Trailer")
	h.Del("Transfer-Encoding")
	h.Del("Upgrade")
}

func marshalHeaders(h http.Header) string {
	if h == nil {
		return "{}"
	}
	b, err := json.Marshal(h)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func truncateBytes(b []byte, limit int) []byte {
	if len(b) <= limit {
		return b
	}
	cp := make([]byte, limit)
	copy(cp, b[:limit])
	return cp
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
