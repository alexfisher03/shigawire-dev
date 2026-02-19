package models

import (
	"encoding/json"
	"fmt"
	"strings"
)

type ProjectConfig struct {
	Scheme string `json:"scheme"`
	Host   string `json:"host"`
	Port   int    `json:"port"`
}

func (c ProjectConfig) UpstreamBaseUrl() string {
	return fmt.Sprintf("%s://%s:%d", c.Scheme, c.Host, c.Port)
}

type rawProjectConfig struct {
	TargetName   string `json:"targetName"`
	TargetScheme string `json:"targetScheme"`
	TargetHost   string `json:"targetHost"`
	TargetPort   int    `json:"targetPort"`
	Scheme       string `json:"scheme"`
	Host         string `json:"host"`
	Port         int    `json:"port"`
}

func NormalizeProjectConfig(configJSON string) (string, error) {
	var raw rawProjectConfig
	if err := json.Unmarshal([]byte(configJSON), &raw); err != nil {
		return "", fmt.Errorf("invalid config_json: %w", err)
	}

	scheme := raw.TargetScheme
	if scheme == "" {
		scheme = raw.Scheme
	}
	if scheme == "" {
		scheme = "http"
	}

	host := raw.TargetHost
	if host == "" {
		host = raw.Host
	}

	port := raw.TargetPort
	if port == 0 {
		port = raw.Port
	}

	if scheme != "http" && scheme != "https" {
		return "", fmt.Errorf("config_json: scheme must be http or https")
	}
	if host == "" {
		return "", fmt.Errorf("config_json: host is required")
	}
	if port <= 0 || port > 65535 {
		return "", fmt.Errorf("config_json: port out of range")
	}

	out := map[string]any{
		"targetName":   raw.TargetName,
		"targetScheme": scheme,
		"targetHost":   host,
		"targetPort":   port,
	}
	b, _ := json.Marshal(out)
	return string(b), nil
}

func ParseProjectConfig(configJSON string) (*ProjectConfig, error) {
	var raw rawProjectConfig
	if err := json.Unmarshal([]byte(configJSON), &raw); err != nil {
		return nil, fmt.Errorf("invalid config_json: %w", err)
	}

	cfg := &ProjectConfig{
		Scheme: firstNonEmpty(strings.TrimSpace(raw.TargetScheme), strings.TrimSpace(raw.Scheme)),
		Host:   firstNonEmpty(strings.TrimSpace(raw.TargetHost), strings.TrimSpace(raw.Host)),
		Port:   firstNonZero(raw.TargetPort, raw.Port),
	}

	if cfg.Scheme != "http" && cfg.Scheme != "https" {
		return nil, fmt.Errorf("config_json: scheme must be http or https")
	}
	if cfg.Host == "" {
		return nil, fmt.Errorf("config_json: host is required")
	}
	if cfg.Port <= 0 || cfg.Port > 65535 {
		return nil, fmt.Errorf("config_json: port out of range")
	}

	return cfg, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func firstNonZero(values ...int) int {
	for _, v := range values {
		if v != 0 {
			return v
		}
	}
	return 0
}
