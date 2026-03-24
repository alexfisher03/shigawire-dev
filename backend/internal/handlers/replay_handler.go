package handlers

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shigawire-dev/internal/replay"
	"github.com/shigawire-dev/internal/store"
)

type ReplayHandler struct {
	st  *store.Store
	rep *replay.ReplayState
}

func NewReplayHandler(st *store.Store, rep *replay.ReplayState) *ReplayHandler {
	return &ReplayHandler{st: st, rep: rep}
}

type StartReplayRequest struct {
	Speed float64 `json:"speed"`
}

func (h *ReplayHandler) StartReplay(c *fiber.Ctx) error {
	sessionId := c.Params("sessionId")

	s, err := store.GetSession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get session"})
	}
	if s == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "session not found"})
	}
	if !s.Sealed {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "session must be sealed before replaying"})
	}

	var req StartReplayRequest
	if c.Request().Header.ContentLength() > 0 {
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
		}
	}

	speed := req.Speed
	if speed <= 0 {
		speed = 1.0
	}

	replayId := "replay_" + uuid.NewString()
	h.rep.Start(replayId, sessionId, speed)

	log.Printf("replay started for session %s", sessionId)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"replay_id": replayId,
	})
}
