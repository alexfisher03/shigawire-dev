package models

import "github.com/google/uuid"

type Project struct {
	Id         string `json:"id"`
	Name       string `json:"name"`
	ConfigJSON string `json:"config_json"`
	CreatedAt  string `json:"created_at"`
}

func GenerateProjectId() string {
	return "proj_" + uuid.NewString()
}
