package replay

import (
	"encoding/json"
	"errors"
	"sync"

	"github.com/google/uuid"
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
	subscribers map[string]chan []byte
	speedC  chan struct{}
}

func NewReplayState() *ReplayState {
	return &ReplayState{
		status:      StatusIdle,
		subscribers: make(map[string]chan []byte),
	}
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
	s.pauseC = make(chan struct{}, 2) // capacity 2: one for Pause(), one for Step() re-queue
	s.resumeC = make(chan struct{}, 1)
	s.stepC = make(chan struct{}, 1)
	s.speedC = make(chan struct{}, 1)
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
	s.broadcast(s.marshalEvent())
	s.closeAllSubscribers()
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
	s.broadcast(s.marshalEvent())
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
	s.broadcast(s.marshalEvent())
	return nil
}

// Step advances the scheduler by exactly one event while paused, then re-pauses.
func (s *ReplayState) Step() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status != StatusPaused {
		return errors.New("replay is not paused")
	}
	// Queue the pause BEFORE the step so it's guaranteed to be in the buffer
	// by the time the scheduler exits drainPause and re-enters waitOrInterrupt.
	select {
	case s.pauseC <- struct{}{}:
	default:
	}
	select {
	case s.stepC <- struct{}{}:
	default:
	}
	return nil
}

// MarkDone is called by the scheduler when all events have been emitted.
// It broadcasts the final state and closes all subscriber channels so WS handlers exit cleanly.
func (s *ReplayState) MarkDone() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status == StatusRunning || s.status == StatusPaused {
		s.status = StatusDone
	}
	s.broadcast(s.marshalEvent())
	s.closeAllSubscribers()
}

// SetSeq updates the current sequence number as the scheduler advances.
func (s *ReplayState) SetSeq(seq int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.currentSeq = seq
	s.broadcast(s.marshalEvent())
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

func (s *ReplayState) SetSpeed(v float64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status != StatusRunning && s.status != StatusPaused {
		return errors.New("no active replay")
	}
	s.speed = v
	select {
	case s.speedC <- struct{}{}:
	default:
	}
	return nil
}

// Channels returns the control channels captured at Start time for use by the scheduler goroutine.
func (s *ReplayState) Channels() (stopC, pauseC, resumeC, stepC, speedC chan struct{}) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.stopC, s.pauseC, s.resumeC, s.stepC, s.speedC
}

// Subscribe registers a new subscriber and returns its ID and receive channel.
// The channel is buffered so slow consumers don't block the scheduler.
func (s *ReplayState) Subscribe() (id string, ch <-chan []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id = uuid.NewString()
	c := make(chan []byte, 64)
	s.subscribers[id] = c
	return id, c
}

// Unsubscribe removes a subscriber and closes its channel.
func (s *ReplayState) Unsubscribe(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.subscribers[id]; ok {
		delete(s.subscribers, id)
		close(c)
	}
}

// WSSnapshot returns the current replay state as JSON for a new WebSocket client.
func (s *ReplayState) WSSnapshot() []byte {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.marshalEvent()
}

// marshalEvent builds the JSON message for the current state.
// Caller must hold s.mu (at least read lock).
func (s *ReplayState) marshalEvent() []byte {
	type wsEvent struct {
		ReplayId   string  `json:"replay_id"`
		Status     Status  `json:"status"`
		CurrentSeq int     `json:"current_seq"`
		Speed      float64 `json:"speed"`
	}
	b, _ := json.Marshal(wsEvent{
		ReplayId:   s.replayId,
		Status:     s.status,
		CurrentSeq: s.currentSeq,
		Speed:      s.speed,
	})
	return b
}

// broadcast sends msg to all subscribers non-blocking. Caller must hold s.mu.
func (s *ReplayState) broadcast(msg []byte) {
	for _, c := range s.subscribers {
		select {
		case c <- msg:
		default:
			// slow consumer — skip rather than block
		}
	}
}

// closeAllSubscribers closes and removes all subscriber channels. Caller must hold s.mu.
// This causes any ranging WS handler to drain buffered messages and exit cleanly.
func (s *ReplayState) closeAllSubscribers() {
	for id, c := range s.subscribers {
		delete(s.subscribers, id)
		close(c)
	}
}
