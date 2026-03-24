package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/shigawire-dev/internal/control"
	"github.com/shigawire-dev/internal/handlers"
	"github.com/shigawire-dev/internal/replay"
	"github.com/shigawire-dev/internal/store"
)

// RegisterRoutes sets up all HTTP routes for the API
func RegisterRoutes(app *fiber.App, st *store.Store, rec *control.RecordingState, rep *replay.ReplayState) {
	v1 := app.Group("/api/v1")

	ph := handlers.NewProjectHandler(st)
	sh := handlers.NewSessionHandler(st, rec)
	eh := handlers.NewEventHandler(st)
	dh := handlers.NewDocsHandler(st)
	rh := handlers.NewReplayHandler(st, rep)

	v1.Post("/projects", ph.CreateProject)
	v1.Get("/projects", ph.ListProjects)
	v1.Get("/projects/:projectId", ph.GetProject)
	v1.Put("/projects/:projectId", ph.UpdateProject)
	v1.Delete("/projects/:projectId", ph.DeleteProject)

	v1.Post("/projects/:projectId/sessions", sh.CreateSession)
	v1.Get("/projects/:projectId/sessions", sh.ListSessions)
	v1.Get("/projects/:projectId/sessions/:sessionId", sh.GetSession)
	v1.Delete("/projects/:projectId/sessions/:sessionId", sh.DeleteSession)

	v1.Post("/projects/:projectId/sessions/:sessionId/record/start", sh.StartRecording)
	v1.Post("/projects/:projectId/sessions/:sessionId/record/stop", sh.StopRecording)
	v1.Post("/projects/:projectId/sessions/:sessionId/capture/stop", sh.StopCapture)
	v1.Get("/projects/:projectId/sessions/:sessionId/record/status", sh.RecordingStatus)

	v1.Get("/record/status", sh.GlobalRecordingStatus)

	v1.Get("/projects/:projectId/sessions/:sessionId/events", eh.ListEvents)
	v1.Post("/projects/:projectId/sessions/:sessionId/events", eh.SeedEvent)

	v1.Post("/projects/:projectId/sessions/:sessionId/replay/start", rh.StartReplay)

	v1.Get("/swagger/*", dh.GetSwaggerSpecification)
	v1.Get("/openapi.yaml", dh.GetOpenAPISpec)
}
