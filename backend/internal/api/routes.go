package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shigawire-dev/internal/handlers"
)

// RegisterRoutes sets up all HTTP routes for the API
func RegisterRoutes(app *fiber.App) {
	v1 := app.Group("/api/v1")

	v1.Get("/sessions/dummy", handlers.GetDummySessions)
	v1.Get("/sessions/:id", handlers.GetDummySession)
	v1.Get("/sessions/:id/events", handlers.GetDummySessionEvents)
}
