package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shigawire-dev/internal/handlers"
)

// RegisterRoutes sets up all HTTP routes for the API
// This function is called from main.go to wire up all endpoints
func RegisterRoutes(app *fiber.App) {
	// Create a route group for version 1 of the API
	// All routes under this group will be prefixed with /api/v1
	v1 := app.Group("/api/v1")

	// Register the dummy sessions endpoint
	// When someone hits GET /api/v1/sessions/dummy, it will call handlers.GetDummySessions
	v1.Get("/sessions/dummy", handlers.GetDummySessions)
}
