package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shigawire-dev/internal/handlers"
	"github.com/shigawire-dev/internal/store"
)

// RegisterRoutes sets up all HTTP routes for the API
func RegisterRoutes(app *fiber.App, st *store.Store) {
	v1 := app.Group("/api/v1")

	ph := handlers.NewProjectHandler(st)
	sh := handlers.NewSessionHandler(st)
	eh := handlers.NewEventHandler(st)

	v1.Post("/projects", ph.CreateProject)
	v1.Get("/projects", ph.ListProjects)
	v1.Get("/projects/:projectId", ph.GetProject)
	v1.Put("/projects/:projectId", ph.UpdateProject)

	v1.Post("/projects/:projectId/sessions", sh.CreateSession)
	v1.Get("/projects/:projectId/sessions", sh.ListSessions)
	v1.Get("/projects/:projectId/sessions/:sessionId", sh.GetSession)

	v1.Get("/projects/:projectId/sessions/:sessionId/events", eh.ListEvents)
	v1.Post("/projects/:projectId/sessions/:sessionId/events", eh.SeedEvent)

	v1.Get("/swagger/*", handlers.GetSwaggerSpecification)
	v1.Get("/openapi.yaml", handlers.GetOpenAPISpec)
}
