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
