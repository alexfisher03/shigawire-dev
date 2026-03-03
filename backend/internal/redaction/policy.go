package redaction

// Header name that should be redacted.
type HeaderRule struct {
	Name string
}

// JSON object key that should be redacted.
type JSONKeyRule struct {
	Key string
}

// Groups together the redaction rules used by the system
type Policy struct {
	HeaderDenylist  []HeaderRule
	JSONKeyDenylist []JSONKeyRule
}

// Default policy used by the backend.
var DefaultPolicy = Policy{
	HeaderDenylist: []HeaderRule{
		{Name: "Authorization"},
		{Name: "Cookie"},
		{Name: "Set-Cookie"},
		{Name: "X-Api-Key"},
	},
	JSONKeyDenylist: []JSONKeyRule{
		{Key: "password"},
		{Key: "token"},
		{Key: "secret"},
	},
}
