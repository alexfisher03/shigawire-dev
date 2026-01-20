package handlers

import (
	"time"

	"fmt"

	"github.com/shigawire-dev/internal/models"
)

func SaveSession(session *models.Session) error {
	fmt.Println("Saving Session", session.Id)
	return nil
}

func CreateSession(name string) (*models.Session, error) {
	session := &models.Session{
		Id:        models.GenerateSessionId(),
		Name:      name,
		CreatedAt: time.Now().Format(time.RFC3339),
		Sealed:    false,
	}

	if err := SaveSession(session); err != nil {
		return nil, err
	}
	return session, nil
}
