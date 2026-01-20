package main

import (
	"fmt"

	"github.com/shigawire-dev/internal/handlers"
)

func main() {
	session, err := handlers.CreateSession("test")

	if err != nil {
		fmt.Println("Failed to create session", err)
		return
	}

	if err := handlers.SaveSession(session); err != nil {
		fmt.Println("Failed to save session", err)
	}

}
