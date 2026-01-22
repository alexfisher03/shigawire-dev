package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	api "github.com/shigawire-dev/internal/api"
)

func main() {
	app := fiber.New(fiber.Config{
		ServerHeader: "Shigawire/1.0",
	})

	app.Use(logger.New())

	api.RegisterRoutes(app)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Server starting on %s", addr)
	log.Fatal(app.Listen(addr))
}
