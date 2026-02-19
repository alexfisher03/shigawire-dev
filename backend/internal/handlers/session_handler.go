package handlers

import (
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
}

func NewSessionHandler(st *store.Store, rec *control.RecordingState) *SessionHandler {
	return &SessionHandler{st: st, rec: rec}
}

type CreateSessionRequest struct {
	Name string `json:"name"`
}

func (h *SessionHandler) GlobalRecordingStatus(c *fiber.Ctx) error {
	active, projectId, sessionId := h.rec.Get()

	return c.JSON(fiber.Map{
		"recording":  active,
		"project_id": projectId,
		"session_id": sessionId,
	})
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
		h.rec.Stop()
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

	// for later, this will become a map once we support multpile sessions recording
	h.rec.Start(projectId, sessionId)

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

	if activeProjectId != projectId || activeSessionId != sessionId {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":             "another session is currently recording",
			"active_project_id": activeProjectId,
			"active_session_id": activeSessionId,
		})
	}

	h.rec.Stop()

	return c.JSON(fiber.Map{
		"recording":  false,
		"project_id": projectId,
		"session_id": sessionId,
	})
}
