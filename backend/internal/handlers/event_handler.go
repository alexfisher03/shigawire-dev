package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shigawire-dev/internal/models"
	"github.com/shigawire-dev/internal/store"
)

type EventHandler struct {
	st *store.Store
}

func NewEventHandler(st *store.Store) *EventHandler {
	return &EventHandler{st: st}
}

func (h *EventHandler) ListEvents(c *fiber.Ctx) error {
	projectId := c.Params("projectId")
	sessionId := c.Params("sessionId")

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil || s.ProjectId != projectId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}

	events, err := store.ListEventsBySession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list events"})
	}

	if c.Query("raw") == "1" {
		return c.JSON(events)
	}

	out := make([]EventReadable, 0, len(events))
	for _, e := range events {
		out = append(out, toReadableEvent(e))
	}
	return c.JSON(out)
}

func (h *EventHandler) SeedEvent(c *fiber.Ctx) error {
	projectId := c.Params("projectId")
	sessionId := c.Params("sessionId")

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil || s.ProjectId != projectId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}

	var maxSeq sql.NullInt64
	err = h.st.DB.QueryRow(
		`SELECT MAX(seq) FROM events WHERE session_id = ?`,
		sessionId,
	).Scan(&maxSeq)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to compute next seq"})
	}

	nextSeq := 1
	if maxSeq.Valid {
		nextSeq = int(maxSeq.Int64) + 1
	}

	e := &models.Event{
		Id:        "event_" + uuid.NewString(),
		SessionId: sessionId,
		Seq:       nextSeq,
		Method:    "PUT",
		URL:       "/seed/test/different",
		Status:    200,
	}

	_, err = h.st.DB.Exec(
		`INSERT INTO events(
			id, session_id, seq, started_at, ended_at, method, url, status,
			req_headers, resp_headers, req_body, resp_body, redaction_applied
		) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.Id, e.SessionId, e.Seq,
		e.StartedAt, e.EndedAt,
		e.Method, e.URL, e.Status,
		e.ReqHeaders, e.RespHeaders,
		e.ReqBody, e.RespBody,
		e.RedactionApplied,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to insert event"})
	}

	return c.Status(fiber.StatusCreated).JSON(e)
}
