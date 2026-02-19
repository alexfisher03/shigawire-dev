package control

import "sync"

type RecordingState struct {
	mu        sync.RWMutex
	active    bool
	projectId string
	sessionId string
}

func NewRecordingState() *RecordingState {
	return &RecordingState{}
}

func (s *RecordingState) Start(projectId, sessionId string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.active = true
	s.projectId = projectId
	s.sessionId = sessionId
}

func (s *RecordingState) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.active = false
	s.projectId = ""
	s.sessionId = ""
}

func (s *RecordingState) Get() (active bool, projectId, sessionId string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active, s.projectId, s.sessionId
}
