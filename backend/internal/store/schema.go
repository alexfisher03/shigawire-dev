package store

import (
	"database/sql"
	"fmt"
)

func InitSchema(db *sql.DB) error {
	ddl := []string{
		`CREATE TABLE IF NOT EXISTS projects(
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			config_json TEXT NOT NULL,
			created_at TEXT NOT NULL
		);`,

		`CREATE TABLE IF NOT EXISTS sessions(
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL DEFAULT '',
			sealed INTEGER NOT NULL,
			FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
		);`,

		`CREATE TABLE IF NOT EXISTS active_recording(
			id INTEGER PRIMARY KEY CHECK (id = 1),
			project_id TEXT NOT NULL,
			session_id TEXT NOT NULL,
			FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
			FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
		);`,

		`CREATE TABLE IF NOT EXISTS events(
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			seq INTEGER NOT NULL,
			started_at TEXT,
			ended_at TEXT,
			method TEXT,
			url TEXT,
			status INTEGER,
			req_headers TEXT,
			resp_headers TEXT,
			req_body TEXT,
			resp_body TEXT,
			redaction_applied TEXT,
			FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE,
			UNIQUE(session_id, seq)
		);`,

		`CREATE INDEX IF NOT EXISTS idx_sessions_project_created
			ON sessions(project_id, created_at);`,

		`CREATE INDEX IF NOT EXISTS idx_events_session_seq
			ON events(session_id, seq);`,
	}

	for _, q := range ddl {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("schema exec failed: %w", err)
		}
	}

	migrations := []string{
		`ALTER TABLE sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`,
	}
	for _, m := range migrations {
		_, _ = db.Exec(m)
	}

	if _, err := db.Exec(
		`UPDATE sessions SET updated_at = created_at WHERE updated_at = ''`,
	); err != nil {
		return fmt.Errorf("backfill updated_at: %w", err)
	}

	return nil
}
