package handlers

import (
	"time"

	"fmt"
	"strings"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/shigawire-dev/internal/models"
)

func SaveSession(session *models.Session) error {
	fmt.Println("Saving Session", session.Id)
	return nil
}

func createNewSession(name string) (*models.Session, error) {
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

func listSessions() []*models.Session {
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

func GetSessions(c *fiber.Ctx) error {
	return c.JSON(listSessions())
}

func GetSession(c *fiber.Ctx) error {
	sessionId := c.Params("id")
	for _, session := range listSessions() {
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

func ListSessionEvents(c *fiber.Ctx) error {
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

func CreateSessionHTTP(c *fiber.Ctx) error {
	var req models.CreateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid JSON body",
		})
	}

	if strings.TrimSpace(req.Name) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name is required",
		})
	}
	session, err := createNewSession(req.Name)
	if err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create session",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(session)
}

func GetSwaggerSpecification(c *fiber.Ctx) error {
	html := `
				<!DOCTYPE html>
				<html lang="en">
				<head>
					<meta charset="UTF-8">
					<title>Swagger UI</title>
					<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
				</head>
				<body>
					<div id="swagger-ui"></div>
					<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
					<script>
						window.onload = function() {
							SwaggerUIBundle({
								url: "/api/v1/openapi.yaml",
								dom_id: '#swagger-ui',
							})
						}
					</script>
				</body>
				</html>
					`
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

func GetOpenAPISpec(c *fiber.Ctx) error {
	return c.SendFile("./docs/openapi.yaml")
}
