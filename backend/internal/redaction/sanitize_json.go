package redaction

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

const redactedValue = "[REDACTED]"

func SanitizeJSON(body []byte) (sanitized []byte, applied []string, err error) {
	var root any
	if err := json.Unmarshal(body, &root); err != nil {
		return nil, nil, fmt.Errorf("parse json: %w", err)
	}

	deny := make(map[string]struct{}, len(DefaultPolicy.JSONKeyDenylist))
	for _, rule := range DefaultPolicy.JSONKeyDenylist {
		deny[strings.ToLower(rule.Key)] = struct{}{}
	}

	sanitizedRoot := sanitizeJSONNode(root, "", deny, &applied)

	out, err := json.Marshal(sanitizedRoot)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal sanitized json: %w", err)
	}

	return out, applied, nil
}

func sanitizeJSONNode(v any, path string, deny map[string]struct{}, applied *[]string) any {
	switch t := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(t))
		for k := range t {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		out := make(map[string]any, len(t))
		for _, k := range keys {
			childPath := k
			if path != "" {
				childPath = path + "." + k
			}

			if _, denied := deny[strings.ToLower(k)]; denied {
				out[k] = redactedValue
				*applied = append(*applied, "json:"+childPath)
				continue
			}

			out[k] = sanitizeJSONNode(t[k], childPath, deny, applied)
		}
		return out
	case []any:
		out := make([]any, len(t))
		for i := range t {
			childPath := fmt.Sprintf("%s[%d]", path, i)
			out[i] = sanitizeJSONNode(t[i], childPath, deny, applied)
		}
		return out
	default:
		return v
	}
}
