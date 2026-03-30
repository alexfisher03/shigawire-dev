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

	stopC, pauseC, resumeC, stepC := state.Channels()

	for i, e := range events {
		state.SetSeq(e.Seq)
		log.Printf("[replay %s] seq=%d %s %s %d", replayId, e.Seq, e.Method, e.URL, e.Status)

		if i == len(events)-1 {
			// Last event — nothing to wait for.
			return
		}

		next := events[i+1]
		delay := interEventDelay(e, next, state.getSpeed())

		if !waitOrInterrupt(delay, stopC, pauseC, resumeC, stepC) {
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
func waitOrInterrupt(delay time.Duration, stopC, pauseC, resumeC, stepC chan struct{}) bool {
	remaining := delay
	for {
		// Check for a pending pause before starting the timer. This ensures that a
		// pause re-queued by Step() is never lost to a timer race when delay is 0.
		select {
		case <-pauseC:
			done, stepped := drainPause(stopC, resumeC, stepC)
			if done {
				return false
			}
			if stepped {
				return true
			}
			continue
		default:
		}

		timer := time.NewTimer(remaining)
		start := time.Now()

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
			done, stepped := drainPause(stopC, resumeC, stepC)
			if done {
				return false
			}
			if stepped {
				return true
			}

		case <-timer.C:
			return true
		}
	}
}

// drainPause blocks until resume, step, or stop while the scheduler is paused.
// Returns (done=true) on stop, (stepped=true) on step, (false, false) on resume.
func drainPause(stopC, resumeC, stepC chan struct{}) (done bool, stepped bool) {
	select {
	case <-stopC:
		return true, false
	case <-stepC:
		return false, true
	case <-resumeC:
		return false, false
	}
}
