package handlers

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/shigawire-dev/internal/models"
	"github.com/shigawire-dev/internal/store"
)

type ProjectHandler struct {
	st *store.Store
}

func NewProjectHandler(st *store.Store) *ProjectHandler {
	return &ProjectHandler{st: st}
}

type CreateProjectRequest struct {
	Name   string          `json:"name"`
	Config json.RawMessage `json:"config"`
}

func (h *ProjectHandler) CreateProject(c *fiber.Ctx) error {
	var request CreateProjectRequest

	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	name := strings.TrimSpace(request.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	cfg := request.Config
	if len(cfg) == 0 {
		cfg = json.RawMessage(`{}`)
	}

	normalized, err := models.NormalizeProjectConfig(string(cfg))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	p := &models.Project{
		Id:         models.GenerateProjectId(),
		Name:       name,
		ConfigJSON: normalized,
		CreatedAt:  time.Now().Format(time.RFC3339),
	}

	if err := store.InsertProject(h.st.DB, p); err != nil {
		// sqlite unique name violation
		lower := strings.ToLower(err.Error())
		if strings.Contains(lower, "unique") && strings.Contains(lower, "projects.name") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "project name already exists"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create project"})
	}

	return c.Status(fiber.StatusCreated).JSON(p)
}

func (h *ProjectHandler) ListProjects(c *fiber.Ctx) error {
	projects, err := store.ListProjects(h.st.DB)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list all projects"})
	}
	return c.JSON(projects)
}

func (h *ProjectHandler) GetProject(c *fiber.Ctx) error {
	projectId := c.Params("projectId")

	p, err := store.GetProject(h.st.DB, projectId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get project"})
	}
	if p == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}
	return c.JSON(p)
}

type UpdateProjectRequest struct {
	Name   string          `json:"name"`
	Config json.RawMessage `json:"config"`
}

func (h *ProjectHandler) UpdateProject(c *fiber.Ctx) error {
	projectId := c.Params("projectId")

	existing, err := store.GetProject(h.st.DB, projectId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get project"})
	}
	if existing == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	var req UpdateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = existing.Name
	}

	cfg := req.Config
	if len(cfg) == 0 {
		cfg = json.RawMessage(existing.ConfigJSON)
	}

	normalized, err := models.NormalizeProjectConfig(string(cfg))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	existing.Name = name
	existing.ConfigJSON = normalized

	if err := store.UpdateProject(h.st.DB, existing); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update project"})
	}

	return c.JSON(existing)
}

func (h *ProjectHandler) DeleteProject(c *fiber.Ctx) error {
	projectId := c.Params("projectId")

	existing, err := store.GetProject(h.st.DB, projectId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get project"})
	}
	if existing == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
	}

	if err := store.DeleteProject(h.st.DB, projectId); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete project"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
