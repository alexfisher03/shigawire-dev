package redaction

import (
	"fmt"
	"net/http"
)

// SanitizeHeaders creates a deep copy of the input headers, applies the provided Policy,
// and returns the sanitized headers along with a list of rules that were applied
func SanitizeHeaders(h http.Header, policy Policy) (http.Header, []string) {
	if h == nil {
		return nil, nil
	}

	sanitized := make(http.Header, len(h))
	for k, vv := range h {
		sanitized[k] = make([]string, len(vv))
		copy(sanitized[k], vv)
	}

	var appliedRules []string

	for _, rule := range policy.HeaderDenylist {
		headerName := rule.Name

		canonicalName := http.CanonicalHeaderKey(headerName)

		if values, ok := sanitized[canonicalName]; ok {
			for i := range values {
				sanitized[canonicalName][i] = "[REDACTED]"
			}
			appliedRules = append(appliedRules, fmt.Sprintf("header:%s", canonicalName))
		}
	}

	return sanitized, appliedRules
}
