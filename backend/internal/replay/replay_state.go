package replay

import "sync"

type ReplayState struct {
	mu         sync.RWMutex
	active     bool
	replayId   string
	sessionId  string
	currentSeq int
	speed      float64
}

func NewReplayState() *ReplayState {
	return &ReplayState{}
}

func (s *ReplayState) Start(replayId, sessionId string, speed float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.active = true
	s.replayId = replayId
	s.sessionId = sessionId
	s.currentSeq = 0
	s.speed = speed
}

func (s *ReplayState) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.active = false
	s.replayId = ""
	s.sessionId = ""
	s.currentSeq = 0
	s.speed = 0
}

func (r *ReplayState) Get() (active bool, replayId, sessionId string, currentSeq int, speed float64) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.active, r.replayId, r.sessionId, r.currentSeq, r.speed
}
