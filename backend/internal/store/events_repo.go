package store

import (
	"database/sql"
	"fmt"

	"github.com/shigawire-dev/internal/models"
)

func ListEventsBySession(db *sql.DB, sessionId string) ([]*models.Event, error) {
	rows, err := db.Query(
		`SELECT id, session_id, seq, started_at, ended_at, method, url, status,
		        req_headers, resp_headers, req_body, resp_body, redaction_applied
		   FROM events
		  WHERE session_id = ?
		  ORDER BY seq ASC`,
		sessionId,
	)
	if err != nil {
		return nil, fmt.Errorf("list events: %w", err)
	}
	defer rows.Close()

	var out []*models.Event
	for rows.Next() {
		var e models.Event
		if err := rows.Scan(
			&e.Id, &e.SessionId, &e.Seq, &e.StartedAt, &e.EndedAt, &e.Method, &e.URL, &e.Status,
			&e.ReqHeaders, &e.RespHeaders, &e.ReqBody, &e.RespBody, &e.RedactionApplied,
		); err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}
		out = append(out, &e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows events: %w", err)
	}
	return out, nil
}

func InsertEvent(db *sql.DB, e *models.Event) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin insert event tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var nextSeq int
	if err := tx.QueryRow(
		`SELECT COALESCE(MAX(seq), 0) + 1 FROM events WHERE session_id = ?`,
		e.SessionId,
	).Scan(&nextSeq); err != nil {
		return fmt.Errorf("compute next seq: %w", err)
	}
	e.Seq = nextSeq

	_, err = tx.Exec(
		`INSERT INTO events(
			id, session_id, seq, started_at, ended_at, method, url, status,
			req_headers, resp_headers, req_body, resp_body, redaction_applied
		) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.Id, e.SessionId, e.Seq,
		e.StartedAt, e.EndedAt,
		e.Method, e.URL, e.Status,
		e.ReqHeaders, e.RespHeaders,
		e.ReqBody, e.RespBody,
		e.RedactionApplied,
	)
	if err != nil {
		return fmt.Errorf("insert event: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit insert event: %w", err)
	}
	return nil
}
