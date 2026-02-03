package store

import (
	"database/sql"
	"fmt"

	"github.com/shigawire-dev/internal/models"
)

func InsertSession(db *sql.DB, s *models.Session) error {
	_, err := db.Exec(
		`INSERT INTO sessions(id, project_id, name, created_at, sealed) VALUES(?, ?, ?, ?, ?)`,
		s.Id, s.ProjectId, s.Name, s.CreatedAt, boolToInt(s.Sealed),
	)
	if err != nil {
		return fmt.Errorf("insert session: %w", err)
	}
	return nil
}

func ListSessionsByProject(db *sql.DB, projectId string) ([]*models.Session, error) {
	rows, err := db.Query(
		`SELECT id, project_id, name, created_at, sealed
		 FROM sessions
		 WHERE project_id = ?
		 ORDER BY created_at DESC`,
		projectId,
	)
	if err != nil {
		return nil, fmt.Errorf("list sessions: %w", err)
	}
	defer rows.Close()

	var out []*models.Session
	for rows.Next() {
		var s models.Session
		var sealed int
		if err := rows.Scan(&s.Id, &s.ProjectId, &s.Name, &s.CreatedAt, &sealed); err != nil {
			return nil, fmt.Errorf("scan session: %w", err)
		}
		s.Sealed = sealed != 0
		out = append(out, &s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows sessions: %w", err)
	}
	return out, nil
}

func GetSession(db *sql.DB, sessionId string) (*models.Session, error) {
	var s models.Session
	var sealed int

	err := db.QueryRow(
		`SELECT id, project_id, name, created_at, sealed
		 FROM sessions
		 WHERE id = ?`,
		sessionId,
	).Scan(&s.Id, &s.ProjectId, &s.Name, &s.CreatedAt, &sealed)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}

	s.Sealed = sealed != 0
	return &s, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
