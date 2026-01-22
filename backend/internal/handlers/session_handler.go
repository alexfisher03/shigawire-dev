package handlers

import (
	"time"

	"fmt"

	"github.com/gofiber/fiber/v2"
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

func GetDummySessions(c *fiber.Ctx) error {
	dummySessions := []*models.Session{}

	sessionNames := []string{
		"API Login Flow",
		"File Upload Session",
		"User Registration",
		"Data Export Request",
		"Health Check Monitoring",
	}

	for i, name := range sessionNames {
		createdAt := time.Now().Add(-time.Duration(i) * time.Hour).Format(time.RFC3339)
		
		session := &models.Session{
			Id:        models.GenerateSessionId(),
			Name:      name,
			CreatedAt: createdAt,
			Sealed:    i%2 == 0,
		}
		dummySessions = append(dummySessions, session)
	}

	return c.JSON(dummySessions)
}
