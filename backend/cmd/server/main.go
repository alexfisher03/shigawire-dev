package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	api "github.com/shigawire-dev/internal/api"
	"github.com/shigawire-dev/internal/store"
)

func main() {
	app := fiber.New(fiber.Config{
		ServerHeader: "Shigawire/1.0",
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Content-Type,Authorization",
	}))

	app.Use(logger.New())

	store, err := store.NewFromEnv()
	if err != nil {
		log.Fatal("failed to initialize store: %w", err)
	}

	defer func() {
		if err := store.DB.Close(); err != nil {
			log.Printf("failed to close db: %p", err)
		}
	}()

	api.RegisterRoutes(app, store)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Server starting on %s", addr)
	log.Fatal(app.Listen(addr))
}
