package store

import "database/sql"

func GetActiveRecording(db *sql.DB) (projectId string, sessionId string, found bool, err error) {
	row := db.QueryRow(`SELECT project_id, session_id FROM active_recording WHERE id = 1`)
	if err := row.Scan(&projectId, &sessionId); err != nil {
		if err == sql.ErrNoRows {
			return "", "", false, nil
		}
		return "", "", false, err
	}
	return projectId, sessionId, true, nil
}

func SetActiveRecording(db *sql.DB, projectId, sessionId string) error {
	if _, err := db.Exec(
		`INSERT INTO active_recording (id, project_id, session_id)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, session_id = excluded.session_id`,
		projectId, sessionId,
	); err != nil {
		return err
	}
	return nil
}

func ClearActiveRecording(db *sql.DB) error {
	if _, err := db.Exec(`DELETE FROM active_recording WHERE id = 1`); err != nil {
		return err
	}
	return nil
}
