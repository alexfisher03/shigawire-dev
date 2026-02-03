package models

type Event struct {
	Id               string `json:"id"`
	SessionId        string `json:"session_id"`
	Seq              int    `json:"seq"`
	StartedAt        string `json:"started_at,omitempty"`
	EndedAt          string `json:"ended_at,omitempty"`
	Method           string `json:"method,omitempty"`
	URL              string `json:"url,omitempty"`
	Status           int    `json:"status,omitempty"`
	ReqHeaders       string `json:"req_headers,omitempty"`
	RespHeaders      string `json:"resp_headers,omitempty"`
	ReqBody          []byte `json:"req_body,omitempty"`
	RespBody         []byte `json:"resp_body,omitempty"`
	RedactionApplied string `json:"redaction_applied,omitempty"`
}
