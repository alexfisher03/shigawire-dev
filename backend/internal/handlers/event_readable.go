package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"mime"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/shigawire-dev/internal/models"
)

type EventReadable struct {
	Id                string              `json:"id"`
	SessionId         string              `json:"session_id"`
	Seq               int                 `json:"seq"`
	StartedAt         string              `json:"started_at,omitempty"`
	EndedAt           string              `json:"ended_at,omitempty"`
	Method            string              `json:"method,omitempty"`
	URL               string              `json:"url,omitempty"`
	Status            int                 `json:"status,omitempty"`
	ReqHeaders        map[string][]string `json:"req_headers,omitempty"`
	RespHeaders       map[string][]string `json:"resp_headers,omitempty"`
	ReqBody           string              `json:"req_body,omitempty"`           // readable text if textual
	RespBody          string              `json:"resp_body,omitempty"`          // readable text if textual
	ReqBodyEncoding   string              `json:"req_body_encoding,omitempty"`  // json|text|base64|empty
	RespBodyEncoding  string              `json:"resp_body_encoding,omitempty"` // json|text|base64|empty
	ReqBodyB64        string              `json:"req_body_b64,omitempty"`       // always available
	RespBodyB64       string              `json:"resp_body_b64,omitempty"`      // always available
	ReqBodyTruncated  bool                `json:"req_body_truncated,omitempty"`
	RespBodyTruncated bool                `json:"resp_body_truncated,omitempty"`
	RedactionApplied  string              `json:"redaction_applied,omitempty"`
}

func toReadableEvent(e *models.Event) EventReadable {
	reqHeaders := parseStoredHeaders(e.ReqHeaders)
	respHeaders := parseStoredHeaders(e.RespHeaders)

	reqBody, reqEnc, reqB64 := decodeBodyForDisplay(e.ReqBody, reqHeaders)
	respBody, respEnc, respB64 := decodeBodyForDisplay(e.RespBody, respHeaders)

	return EventReadable{
		Id:                e.Id,
		SessionId:         e.SessionId,
		Seq:               e.Seq,
		StartedAt:         e.StartedAt,
		EndedAt:           e.EndedAt,
		Method:            e.Method,
		URL:               e.URL,
		Status:            e.Status,
		ReqHeaders:        reqHeaders,
		RespHeaders:       respHeaders,
		ReqBody:           reqBody,
		RespBody:          respBody,
		ReqBodyEncoding:   reqEnc,
		RespBodyEncoding:  respEnc,
		ReqBodyB64:        reqB64,
		RespBodyB64:       respB64,
		ReqBodyTruncated:  isTruncated(e.ReqBody, reqHeaders),
		RespBodyTruncated: isTruncated(e.RespBody, respHeaders),
		RedactionApplied:  e.RedactionApplied,
	}
}

func parseStoredHeaders(raw string) map[string][]string {
	if strings.TrimSpace(raw) == "" {
		return map[string][]string{}
	}
	var out map[string][]string
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return map[string][]string{
			"_raw": {raw},
		}
	}
	return out
}

func decodeBodyForDisplay(body []byte, headers map[string][]string) (display string, encoding string, b64 string) {
	if len(body) == 0 {
		return "", "empty", ""
	}

	b64 = base64.StdEncoding.EncodeToString(body)

	ct := firstHeader(headers, "Content-Type")
	mediaType, _, _ := mime.ParseMediaType(ct)
	mediaType = strings.ToLower(mediaType)

	if isTextual(mediaType) && utf8.Valid(body) {
		if strings.Contains(mediaType, "json") {
			var pretty bytes.Buffer
			if json.Indent(&pretty, body, "", "  ") == nil {
				return pretty.String(), "json", b64
			}
		}
		return string(body), "text", b64
	}

	return "", "base64", b64
}

func isTextual(mediaType string) bool {
	if strings.HasPrefix(mediaType, "text/") {
		return true
	}
	switch mediaType {
	case "application/json", "application/xml", "application/x-www-form-urlencoded":
		return true
	}
	return strings.HasSuffix(mediaType, "+json") || strings.HasSuffix(mediaType, "+xml")
}

func firstHeader(h map[string][]string, key string) string {
	if vals, ok := h[key]; ok && len(vals) > 0 {
		return vals[0]
	}
	// fallback lowercase scan
	kl := strings.ToLower(key)
	for k, vals := range h {
		if strings.ToLower(k) == kl && len(vals) > 0 {
			return vals[0]
		}
	}
	return ""
}

func isTruncated(body []byte, headers map[string][]string) bool {
	clRaw := strings.TrimSpace(firstHeader(headers, "Content-Length"))
	if clRaw == "" {
		return false
	}
	cl, err := strconv.Atoi(clRaw)
	if err != nil || cl <= 0 {
		return false
	}
	return len(body) < cl
}
