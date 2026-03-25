package replay

import (
	"errors"
	"sync"
)

type Status string

const (
	StatusIdle    Status = "idle"
	StatusRunning Status = "running"
	StatusPaused  Status = "paused"
	StatusDone    Status = "done"
)

type ReplayState struct {
	mu         sync.RWMutex
	status     Status
	replayId   string
	sessionId  string
	currentSeq int
	speed      float64

	stopC   chan struct{}
	pauseC  chan struct{}
	resumeC chan struct{}
	stepC   chan struct{}
}

func NewReplayState() *ReplayState {
	return &ReplayState{status: StatusIdle}
}

func (s *ReplayState) Start(replayId, sessionId string, speed float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.status = StatusRunning
	s.replayId = replayId
	s.sessionId = sessionId
	s.currentSeq = 0
	s.speed = speed
	s.stopC = make(chan struct{})
	s.pauseC = make(chan struct{}, 1)
	s.resumeC = make(chan struct{}, 1)
	s.stepC = make(chan struct{}, 1)
}

// Stop signals the scheduler to exit and resets state to idle.
func (s *ReplayState) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status == StatusRunning || s.status == StatusPaused {
		close(s.stopC)
	}
	s.status = StatusIdle
	s.replayId = ""
	s.sessionId = ""
	s.currentSeq = 0
	s.speed = 0
}

// Pause signals the scheduler to stop the current inter-event wait.
func (s *ReplayState) Pause() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status != StatusRunning {
		return errors.New("replay is not running")
	}
	s.status = StatusPaused
	select {
	case s.pauseC <- struct{}{}:
	default:
	}
	return nil
}

// Resume signals the scheduler to continue waiting after a pause.
func (s *ReplayState) Resume() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status != StatusPaused {
		return errors.New("replay is not paused")
	}
	s.status = StatusRunning
	select {
	case s.resumeC <- struct{}{}:
	default:
	}
	return nil
}

// Step advances the scheduler by exactly one event while paused.
func (s *ReplayState) Step() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status != StatusPaused {
		return errors.New("replay is not paused")
	}
	select {
	case s.stepC <- struct{}{}:
	default:
	}
	return nil
}

// MarkDone is called by the scheduler when all events have been emitted.
func (s *ReplayState) MarkDone() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status == StatusRunning || s.status == StatusPaused {
		s.status = StatusDone
	}
}

// SetSeq updates the current sequence number as the scheduler advances.
func (s *ReplayState) SetSeq(seq int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.currentSeq = seq
}

func (s *ReplayState) Get() (status Status, replayId, sessionId string, currentSeq int, speed float64) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status, s.replayId, s.sessionId, s.currentSeq, s.speed
}

// speed returns the current speed factor. Safe to call from the scheduler goroutine.
func (s *ReplayState) getSpeed() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.speed
}

// Channels returns the control channels captured at Start time for use by the scheduler goroutine.
func (s *ReplayState) Channels() (stopC, pauseC, resumeC, stepC chan struct{}) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.stopC, s.pauseC, s.resumeC, s.stepC
}
