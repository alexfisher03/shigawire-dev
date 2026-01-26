package models

type Event struct {
	Id        string `json:"id"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	Status    int    `json:"status"`
	Duration  int    `json:"duration"`
	Timestamp string `json:"timestamp"`
}
