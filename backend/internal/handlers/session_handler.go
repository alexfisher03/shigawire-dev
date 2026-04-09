package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/shigawire-dev/internal/control"
	"github.com/shigawire-dev/internal/models"
	"github.com/shigawire-dev/internal/store"
)

type SessionHandler struct {
	st  *store.Store
	rec *control.RecordingState
	eb  *control.EventBus
}

func NewSessionHandler(st *store.Store, rec *control.RecordingState, eb *control.EventBus) *SessionHandler {
	return &SessionHandler{st: st, rec: rec, eb: eb}
}

type CreateSessionRequest struct {
	Name string `json:"name"`
}

func (h *SessionHandler) computeGlobalRecordingStatus() (fiber.Map, error) {
	active, projectId, sessionId := h.rec.Get()
	if !active {
		return fiber.Map{
			"recording":  false,
			"project_id": "",
			"session_id": "",
		}, nil
	}

	if projectId == "" || sessionId == "" {
		if err := h.rec.Stop(); err != nil {
			return nil, err
		}
		return fiber.Map{
			"recording":      false,
			"project_id":     "",
			"session_id":     "",
			"state_repaired": true,
			"message":        "recording state was invalid and has been reset",
		}, nil
	}

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return nil, err
	}
	if s == nil {
		if err := h.rec.Stop(); err != nil {
			return nil, err
		}
		return fiber.Map{
			"recording":      false,
			"project_id":     "",
			"session_id":     "",
			"state_repaired": true,
			"message":        "active session not found; recording state reset",
		}, nil
	}

	if s.ProjectId != projectId {
		projectId = s.ProjectId
		if err := h.rec.Start(projectId, sessionId); err != nil {
			return nil, err
		}
	}

	p, err := store.GetProject(h.st.DB, projectId)
	if err != nil {
		return nil, err
	}
	if p == nil {
		if err := h.rec.Stop(); err != nil {
			return nil, err
		}
		return fiber.Map{
			"recording":      false,
			"project_id":     "",
			"session_id":     "",
			"state_repaired": true,
			"message":        "active project not found; recording state reset",
		}, nil
	}

	return fiber.Map{
		"recording":  true,
		"project_id": projectId,
		"session_id": sessionId,
	}, nil
}

func (h *SessionHandler) GlobalRecordingStatus(c *fiber.Ctx) error {
	m, err := h.computeGlobalRecordingStatus()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve recording status"})
	}
	return c.JSON(m)
}

func (h *SessionHandler) RecordStatusStream(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		subID, ch := h.rec.Subscribe()
		defer h.rec.Unsubscribe(subID)

		send := func() bool {
			m, err := h.computeGlobalRecordingStatus()
			if err != nil {
				log.Printf("record stream compute: %v", err)
				m = fiber.Map{"recording": false, "project_id": "", "session_id": ""}
			}
			b, err := json.Marshal(m)
			if err != nil {
				return false
			}
			if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
				return false
			}
			return w.Flush() == nil
		}

		if !send() {
			return
		}

		keepAlive := time.NewTicker(25 * time.Second)
		defer keepAlive.Stop()

		for {
			select {
			case <-reqCtx.Done():
				return
			case <-ch:
				if !send() {
					return
				}
			case <-keepAlive.C:
				if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
					return
				}
				if w.Flush() != nil {
					return
				}
			}
		}
	})

	return nil
}

func (h *SessionHandler) CreateSession(c *fiber.Ctx) error {
	projectId := c.Params("projectId")

	p, err := store.GetProject(h.st.DB, projectId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get project"})
	}
	if p == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	var req CreateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	s := &models.Session{
		Id:        models.GenerateSessionId(),
		ProjectId: projectId,
		Name:      name,
		CreatedAt: time.Now().Format(time.RFC3339),
		Sealed:    false,
	}

	if err := store.InsertSession(h.st.DB, s); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create session"})
	}

	return c.Status(fiber.StatusCreated).JSON(s)
}

func (h *SessionHandler) ListSessions(c *fiber.Ctx) error {
	projectId := c.Params("projectId")

	p, err := store.GetProject(h.st.DB, projectId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get project"})
	}
	if p == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	sessions, err := store.ListSessionsByProject(h.st.DB, projectId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list sessions"})
	}
	return c.JSON(sessions)
}

func (h *SessionHandler) GetSession(c *fiber.Ctx) error {
	projectId := c.Params("projectId")
	sessionId := c.Params("sessionId")

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil || s.ProjectId != projectId {
		// if session exists but not under this project, treat as not found
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}

	return c.JSON(s)
}

func (h *SessionHandler) DeleteSession(c *fiber.Ctx) error {
	projectId := c.Params("projectId")
	sessionId := c.Params("sessionId")

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil || s.ProjectId != projectId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}

	active, _, activeSessionId := h.rec.Get()
	if active && activeSessionId == sessionId {
		if err := h.rec.Stop(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to stop recording state"})
		}
	}

	if err := store.DeleteSession(h.st.DB, sessionId); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete session"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *SessionHandler) StartRecording(c *fiber.Ctx) error {
	projectId := c.Params("projectId")
	sessionId := c.Params("sessionId")

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil || s.ProjectId != projectId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}
	if s.Sealed {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "cannot record: session is sealed"})
	}

	if err := h.rec.Start(s.ProjectId, sessionId); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to start recording"})
	}
	_ = store.TouchSessionUpdatedAt(h.st.DB, sessionId, time.Now().UTC().Format(time.RFC3339Nano))
	projectId = s.ProjectId

	return c.JSON(fiber.Map{
		"recording":  true,
		"project_id": projectId,
		"session_id": sessionId,
	})
}

func (h *SessionHandler) RecordingStatus(c *fiber.Ctx) error {
	projectId := c.Params("projectId")
	sessionId := c.Params("sessionId")

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil || s.ProjectId != projectId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}

	active, activeProjectId, activeSessionId := h.rec.Get()
	recording := active && activeProjectId == projectId && activeSessionId == sessionId
	if !recording {
		return c.JSON(fiber.Map{
			"recording":  false,
			"project_id": projectId,
			"session_id": sessionId,
		})
	}

	return c.JSON(fiber.Map{
		"recording":  true,
		"project_id": projectId,
		"session_id": sessionId,
	})
}

func (h *SessionHandler) StopRecording(c *fiber.Ctx) error {
	projectId := c.Params("projectId")
	sessionId := c.Params("sessionId")

	// Validate the session exists and belongs to project, so stop is not ambiguous
	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil || s.ProjectId != projectId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}

	active, activeProjectId, activeSessionId := h.rec.Get()
	if !active {
		return c.JSON(fiber.Map{
			"recording": false,
			"message":   "recording already stopped",
		})
	}

	if activeSessionId == sessionId && activeProjectId != projectId {
		// corrupted state: same session, wrong project id
		if err := h.rec.Stop(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to stop recording state"})
		}
		return c.JSON(fiber.Map{
			"recording":      false,
			"project_id":     projectId,
			"session_id":     sessionId,
			"state_repaired": true,
			"message":        "recording state repaired and stopped",
		})
	}

	if activeProjectId != projectId || activeSessionId != sessionId {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":             "another session is currently recording",
			"active_project_id": activeProjectId,
			"active_session_id": activeSessionId,
		})
	}

	if err := h.rec.Stop(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to stop recording state"})
	}

	return c.JSON(fiber.Map{
		"recording":  false,
		"project_id": projectId,
		"session_id": sessionId,
	})
}

func (h *SessionHandler) StopCapture(c *fiber.Ctx) error {
	projectId := c.Params("projectId")
	sessionId := c.Params("sessionId")

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil || s.ProjectId != projectId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}

	if s.Sealed {
		return c.JSON(fiber.Map{
			"sealed":    true,
			"recording": false,
		})
	}

	active, _, activeSessionId := h.rec.Get()
	if active && activeSessionId == sessionId {
		if err := h.rec.Stop(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to stop recording state"})
		}
	}

	if err := store.SealSession(h.st.DB, sessionId); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to seal session"})
	}

	return c.JSON(fiber.Map{
		"sealed":    true,
		"recording": false,
	})
}

func (h *SessionHandler) EventStream(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	reqCtx := c.UserContext()
	if reqCtx == nil {
		reqCtx = context.Background()
	}

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		subID, ch := h.eb.Subscribe()
		defer h.eb.Unsubscribe(subID)

		keepAlive := time.NewTicker(25 * time.Second)
		defer keepAlive.Stop()

		for {
			select {
			case <-reqCtx.Done():
				return
			case n := <-ch:
				b, err := json.Marshal(n)
				if err != nil {
					continue
				}
				if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
					return
				}
				if w.Flush() != nil {
					return
				}
			case <-keepAlive.C:
				if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
					return
				}
				if w.Flush() != nil {
					return
				}
			}
		}
	})

	return nil
}
