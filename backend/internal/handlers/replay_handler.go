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

	events, err := store.ListEventsBySession(h.st.DB, sessionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load events"})
	}

	replayId := "replay_" + uuid.NewString()
	h.rep.Start(replayId, sessionId, speed)

	go replay.Run(replayId, events, h.rep)

	log.Printf("replay started: id=%s session=%s events=%d speed=%.1fx", replayId, sessionId, len(events), speed)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"replay_id": replayId,
	})
}

func (h *ReplayHandler) StopReplay(c *fiber.Ctx) error {
	replayId := c.Params("replayId")
	status, currentId, _, _, _ := h.rep.Get()
	if status == replay.StatusIdle || currentId != replayId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "replay not found"})
	}
	h.rep.Stop()
	log.Printf("replay stopped: id=%s", replayId)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ReplayHandler) PauseReplay(c *fiber.Ctx) error {
	replayId := c.Params("replayId")
	status, currentId, _, _, _ := h.rep.Get()
	if status == replay.StatusIdle || currentId != replayId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "replay not found"})
	}
	if err := h.rep.Pause(); err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	log.Printf("replay paused: id=%s", replayId)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ReplayHandler) ResumeReplay(c *fiber.Ctx) error {
	replayId := c.Params("replayId")
	status, currentId, _, _, _ := h.rep.Get()
	if status == replay.StatusIdle || currentId != replayId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "replay not found"})
	}
	if err := h.rep.Resume(); err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	log.Printf("replay resumed: id=%s", replayId)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ReplayHandler) StepReplay(c *fiber.Ctx) error {
	replayId := c.Params("replayId")
	status, currentId, _, _, _ := h.rep.Get()
	if status == replay.StatusIdle || currentId != replayId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "replay not found"})
	}
	if err := h.rep.Step(); err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	log.Printf("replay stepped: id=%s", replayId)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *ReplayHandler) GetReplayStatus(c *fiber.Ctx) error {
	replayId := c.Params("replayId")
	status, currentId, sessionId, currentSeq, speed := h.rep.Get()
	if status == replay.StatusIdle || currentId != replayId {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "replay not found"})
	}
	return c.JSON(fiber.Map{
		"replay_id":   currentId,
		"session_id":  sessionId,
		"status":      status,
		"current_seq": currentSeq,
		"speed":       speed,
	})
}
