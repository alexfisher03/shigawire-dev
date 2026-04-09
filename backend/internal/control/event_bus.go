package control

import (
	"sync"

	"github.com/google/uuid"
)

type EventNotification struct {
	SessionID  string `json:"session_id"`
	EventID    string `json:"event_id"`
	Method     string `json:"method"`
	URL        string `json:"url"`
	Status     int    `json:"status"`
	TotalCount int    `json:"total_count"`
}

type EventBus struct {
	mu          sync.Mutex
	subscribers map[string]chan EventNotification
}

func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string]chan EventNotification),
	}
}

func (b *EventBus) Subscribe() (id string, ch <-chan EventNotification) {
	c := make(chan EventNotification, 64)
	id = uuid.NewString()
	b.mu.Lock()
	b.subscribers[id] = c
	b.mu.Unlock()
	return id, c
}

func (b *EventBus) Unsubscribe(id string) {
	b.mu.Lock()
	delete(b.subscribers, id)
	b.mu.Unlock()
}

func (b *EventBus) Publish(n EventNotification) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, ch := range b.subscribers {
		select {
		case ch <- n:
		default:
		}
	}
}
