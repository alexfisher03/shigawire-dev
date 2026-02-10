package store

import (
	"database/sql"
	"fmt"

	"github.com/shigawire-dev/internal/models"
)

func InsertProject(db *sql.DB, p *models.Project) error {
	_, err := db.Exec(
		`INSERT INTO projects(id, name, config_json, created_at) VALUES(?, ?, ?, ?)`,
		p.Id, p.Name, p.ConfigJSON, p.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert project: %w", err)
	}
	return nil
}

func ListProjects(db *sql.DB) ([]*models.Project, error) {
	rows, err := db.Query(`SELECT id, name, config_json, created_at FROM projects ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}
	defer rows.Close()

	var out []*models.Project
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.Id, &p.Name, &p.ConfigJSON, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}
		out = append(out, &p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows projects: %w", err)
	}
	return out, nil
}

func GetProject(db *sql.DB, id string) (*models.Project, error) {
	var p models.Project
	err := db.QueryRow(`SELECT id, name, config_json, created_at FROM projects WHERE id = ?`, id).
		Scan(&p.Id, &p.Name, &p.ConfigJSON, &p.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get project: %w", err)
	}
	return &p, nil
}

func UpdateProject(db *sql.DB, p *models.Project) error {
	_, err := db.Exec(
		`UPDATE projects SET name = ?, config_json = ? WHERE id = ?`,
		p.Name, p.ConfigJSON, p.Id,
	)
	if err != nil {
		return fmt.Errorf("update project: %w", err)
	}
	return nil
}

func DeleteProject(db *sql.DB, id string) error {
	_, err := db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete project: %w", err)
	}
	return nil
}
