package handlers

import (
	"github.com/gofiber/fiber/v2"
)

func GetSwaggerSpecification(c *fiber.Ctx) error {
	html := `
				<!DOCTYPE html>
				<html lang="en">
				<head>
					<meta charset="UTF-8">
					<title>Swagger UI</title>
					<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
				</head>
				<body>
					<div id="swagger-ui"></div>
					<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
					<script>
						window.onload = function() {
							SwaggerUIBundle({
								url: "/api/v1/openapi.yaml",
								dom_id: '#swagger-ui',
							})
						}
					</script>
				</body>
				</html>
					`
	c.Set("Content-Type", "text/html")
	return c.SendString(html)
}

func GetOpenAPISpec(c *fiber.Ctx) error {
	return c.SendFile("./docs/openapi.yaml")
}
