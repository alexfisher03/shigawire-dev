package models

import (
	"github.com/google/uuid"
)

type Session struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	Sealed    bool   `json:"sealed"`
}

func GenerateSessionId() string {
	return "session_" + uuid.NewString()
}
