package control

import (
	"database/sql"
	"sync"

	"github.com/google/uuid"
	"github.com/shigawire-dev/internal/store"
)

type RecordingState struct {
	mu        sync.RWMutex
	db        *sql.DB
	active    bool
	projectId string
	sessionId string

	subsMu      sync.Mutex
	subscribers map[string]chan struct{}
}

func NewRecordingState(db *sql.DB) (*RecordingState, error) {
	rs := &RecordingState{db: db}

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
	err := store.SetActiveRecording(s.db, projectId, sessionId)
	if err != nil {
		s.mu.Unlock()
		return err
	}
	s.active = true
	s.projectId = projectId
	s.sessionId = sessionId
	s.mu.Unlock()
	s.notifyChange()
	return nil
}

func (s *RecordingState) Stop() error {
	s.mu.Lock()
	err := store.ClearActiveRecording(s.db)
	if err != nil {
		s.mu.Unlock()
		return err
	}
	s.active = false
	s.projectId = ""
	s.sessionId = ""
	s.mu.Unlock()
	s.notifyChange()
	return nil
}

func (s *RecordingState) Get() (active bool, projectId, sessionId string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active, s.projectId, s.sessionId
}

func (s *RecordingState) Subscribe() (id string, updates <-chan struct{}) {
	ch := make(chan struct{}, 16)
	id = uuid.NewString()
	s.subsMu.Lock()
	if s.subscribers == nil {
		s.subscribers = make(map[string]chan struct{})
	}
	s.subscribers[id] = ch
	s.subsMu.Unlock()
	return id, ch
}

func (s *RecordingState) Unsubscribe(id string) {
	s.subsMu.Lock()
	delete(s.subscribers, id)
	s.subsMu.Unlock()
}

func (s *RecordingState) notifyChange() {
	s.subsMu.Lock()
	defer s.subsMu.Unlock()
	for _, ch := range s.subscribers {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}
