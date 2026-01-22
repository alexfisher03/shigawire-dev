package handlers

import (
	"time"

	"fmt"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/shigawire-dev/internal/models"
)

func SaveSession(session *models.Session) error {
	fmt.Println("Saving Session", session.Id)
	return nil
}

func CreateSession(name string) (*models.Session, error) {
	session := &models.Session{
		Id:        models.GenerateSessionId(),
		Name:      name,
		CreatedAt: time.Now().Format(time.RFC3339),
		Sealed:    false,
	}

	if err := SaveSession(session); err != nil {
		return nil, err
	}
	return session, nil
}

var (
	dummySessions     []*models.Session
	dummySessionsOnce sync.Once
)

func getDummySessions() []*models.Session {
	dummySessionsOnce.Do(func() {
		sessionNames := []string{
			"API Login Flow",
			"File Upload Session",
			"User Registration",
			"Data Export Request",
			"Health Check Monitoring",
		}

		now := time.Now()
		for i, name := range sessionNames {
			createdAt := now.Add(-time.Duration(i) * time.Hour).Format(time.RFC3339)
			session := &models.Session{
				Id:        models.GenerateSessionId(),
				Name:      name,
				CreatedAt: createdAt,
				Sealed:    i%2 == 0,
			}
			dummySessions = append(dummySessions, session)
		}
	})

	return dummySessions
}

func GetDummySessions(c *fiber.Ctx) error {
	return c.JSON(getDummySessions())
}

func GetDummySession(c *fiber.Ctx) error {
	sessionId := c.Params("id")
	for _, session := range getDummySessions() {
		if session.Id == sessionId {
			return c.JSON(session)
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error": "session not found",
	})
}

type dummyEvent struct {
	Id        string `json:"id"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	Status    int    `json:"status"`
	Duration  int    `json:"duration"`
	Timestamp string `json:"timestamp"`
}

func GetDummySessionEvents(c *fiber.Ctx) error {
	sessionId := c.Params("id")
	now := time.Now()

	events := []dummyEvent{
		{
			Id:        fmt.Sprintf("%s_evt_1", sessionId),
			Method:    "POST",
			Path:      "/api/v1/login",
			Status:    200,
			Duration:  184,
			Timestamp: now.Add(-4 * time.Minute).Format(time.RFC3339),
		},
		{
			Id:        fmt.Sprintf("%s_evt_2", sessionId),
			Method:    "GET",
			Path:      "/api/v1/profile",
			Status:    200,
			Duration:  92,
			Timestamp: now.Add(-3 * time.Minute).Format(time.RFC3339),
		},
		{
			Id:        fmt.Sprintf("%s_evt_3", sessionId),
			Method:    "PUT",
			Path:      "/api/v1/profile",
			Status:    204,
			Duration:  221,
			Timestamp: now.Add(-2 * time.Minute).Format(time.RFC3339),
		},
		{
			Id:        fmt.Sprintf("%s_evt_4", sessionId),
			Method:    "GET",
			Path:      "/api/v1/notifications",
			Status:    503,
			Duration:  512,
			Timestamp: now.Add(-90 * time.Second).Format(time.RFC3339),
		},
	}

	return c.JSON(events)
}
