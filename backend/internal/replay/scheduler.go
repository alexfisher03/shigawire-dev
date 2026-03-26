package replay

import (
	"log"
	"time"

	"github.com/shigawire-dev/internal/models"
)

// Run walks the provided events in seq order, emitting each one and waiting the
// recorded inter-event delay scaled by the replay speed. It returns when all
// events have been emitted, or when the replay is stopped via state.Stop().
//
// Call this in a goroutine: go Run(replayId, events, state)
func Run(replayId string, events []*models.Event, state *ReplayState) {
	defer state.MarkDone()

	stopC, pauseC, resumeC, stepC, speedC := state.Channels()

	for i, e := range events {
		state.SetSeq(e.Seq)
		log.Printf("[replay %s] seq=%d %s %s %d", replayId, e.Seq, e.Method, e.URL, e.Status)

		if i == len(events)-1 {
			// Last event — nothing to wait for.
			return
		}

		next := events[i+1]
		delay := interEventDelay(e, next, state.getSpeed())

		if !waitOrInterrupt(delay, stopC, pauseC, resumeC, stepC, speedC, state.getSpeed) {
			return // stopped
		}
	}
}

// interEventDelay computes the time to wait between e and next, divided by speed.
func interEventDelay(e, next *models.Event, speed float64) time.Duration {
	t1, err1 := time.Parse(time.RFC3339Nano, e.StartedAt)
	t2, err2 := time.Parse(time.RFC3339Nano, next.StartedAt)
	if err1 != nil || err2 != nil || !t2.After(t1) {
		return 0
	}
	if speed <= 0 {
		speed = 1.0
	}
	return time.Duration(float64(t2.Sub(t1)) / speed)
}

// waitOrInterrupt waits for delay, but can be interrupted by a pause, stop, or step signal.
// Returns true when the delay elapses or a step is received (caller should advance to next event).
// Returns false when a stop is received (caller should exit).
func waitOrInterrupt(delay time.Duration, stopC, pauseC, resumeC, stepC, speedC chan struct{}, getSpeed func() float64) bool {
	remaining := delay
	for {
		timer := time.NewTimer(remaining)
		start := time.Now()
		currentSpeed := getSpeed()

		select {
		case <-stopC:
			timer.Stop()
			return false

		case <-pauseC:
			timer.Stop()
			elapsed := time.Since(start)
			remaining -= elapsed
			if remaining < 0 {
				remaining = 0
			}
			// Blocked until resume, step, or stop.
			select {
			case <-stopC:
				return false
			case <-stepC:
				return true
			case <-resumeC:
				// Re-enter outer loop with remaining time.
			}

		case <-speedC:
			timer.Stop()
			elapsed := time.Since(start)
			newSpeed := getSpeed()
			unelapsed := remaining - elapsed
			if unelapsed < 0 {
				unelapsed = 0
			}
			remaining = time.Duration(float64(unelapsed) * (currentSpeed / newSpeed))
			currentSpeed = newSpeed

		case <-timer.C:
			return true
		}
	}
}
