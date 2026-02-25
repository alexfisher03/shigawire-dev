package control

import (
	"database/sql"
	"sync"

	"github.com/shigawire-dev/internal/store"
)

type RecordingState struct {
	mu        sync.RWMutex
	db        *sql.DB
	active    bool
	projectId string
	sessionId string
}

func NewRecordingState(db *sql.DB) (*RecordingState, error) {
	rs := &RecordingState{db: db}

	// check if there is an active recording in the database already
	projectId, sessionId, found, err := store.GetActiveRecording(db)
	if err != nil {
		return nil, err
	}
	if found {
		rs.active = true
		rs.projectId = projectId
		rs.sessionId = sessionId
	}
	return rs, nil
}

func (s *RecordingState) Start(projectId, sessionId string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := store.SetActiveRecording(s.db, projectId, sessionId); err != nil {
		return err
	}

	s.active = true
	s.projectId = projectId
	s.sessionId = sessionId
	return nil
}

func (s *RecordingState) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := store.ClearActiveRecording(s.db); err != nil {
		return err
	}
	s.active = false
	s.projectId = ""
	s.sessionId = ""
	return nil
}

func (s *RecordingState) Get() (active bool, projectId, sessionId string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active, s.projectId, s.sessionId
}
