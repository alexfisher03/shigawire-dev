package models

import (
	"time"
)

type Event struct {
	Id        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Type      string    `json:"type"` // Request | Response

}
