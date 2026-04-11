package httpbody

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"fmt"
	"io"
	"mime"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/andybalholm/brotli"
)

var b64Regex = regexp.MustCompile(`(data:[^\s]+?;base64,)?([A-Za-z0-9+/]{200,}[=]{0,2})`)

type FormatOptions struct {
	MaxOutputBytes  int64
	TrimLargeBase64 bool
}

type FormatResult struct {
	Text        string
	Truncated   bool
	Decoded     bool
	DecodedFrom string
}

func FormatForDisplay(contentType, contentEncoding string, body []byte, opts FormatOptions) FormatResult {
	if len(body) == 0 {
		return FormatResult{}
	}

	data := body
	decompressed := false
	truncated := false
	decodedFrom := ""

	if decoded, wasTruncated, appliedEncoding, ok := decodeContent(contentEncoding, body, opts.MaxOutputBytes); ok {
		data = decoded
		decompressed = true
		truncated = truncated || wasTruncated
		decodedFrom = appliedEncoding
	}

	if isProbablyText(contentType) && utf8.Valid(data) {
		return FormatResult{
			Text:        sanitizeText(string(data), opts.TrimLargeBase64),
			Truncated:   truncated,
			Decoded:     decompressed,
			DecodedFrom: decodedFrom,
		}
	}

	if utf8.Valid(data) {
		return FormatResult{
			Text:        sanitizeText(string(data), opts.TrimLargeBase64),
			Truncated:   truncated,
			Decoded:     decompressed,
			DecodedFrom: decodedFrom,
		}
	}

	if decompressed {
		if truncated {
			return FormatResult{
				Text:        fmt.Sprintf("[binary content omitted; %d bytes after decompression (truncated)]", len(data)),
				Truncated:   true,
				Decoded:     true,
				DecodedFrom: decodedFrom,
			}
		}
		return FormatResult{
			Text:        fmt.Sprintf("[binary content omitted; %d bytes after decompression]", len(data)),
			Decoded:     true,
			DecodedFrom: decodedFrom,
		}
	}

	return FormatResult{
		Text: fmt.Sprintf("[binary content omitted; %d bytes captured]", len(body)),
	}
}

func decodeContent(contentEncoding string, body []byte, maxOutputBytes int64) ([]byte, bool, string, bool) {
	tokens := normalizedEncodings(contentEncoding)
	if len(tokens) == 0 {
		return nil, false, "", false
	}

	data := body
	truncated := false

	for i := len(tokens) - 1; i >= 0; i-- {
		decoded, wasTruncated, ok := decodeOnce(tokens[i], data, maxOutputBytes)
		if !ok {
			return nil, false, "", false
		}
		data = decoded
		truncated = truncated || wasTruncated
	}

	return data, truncated, strings.Join(tokens, ", "), true
}

func decodeOnce(encoding string, body []byte, maxOutputBytes int64) ([]byte, bool, bool) {
	switch encoding {
	case "gzip":
		r, err := gzip.NewReader(bytes.NewReader(body))
		if err != nil {
			return nil, false, false
		}
		defer r.Close()

		data, truncated, err := readAllLimited(r, maxOutputBytes)
		if err != nil {
			return nil, false, false
		}
		return data, truncated, true
	case "deflate":
		r := flate.NewReader(bytes.NewReader(body))
		defer r.Close()

		data, truncated, err := readAllLimited(r, maxOutputBytes)
		if err != nil {
			return nil, false, false
		}
		return data, truncated, true
	case "br":
		data, truncated, err := readAllLimited(brotli.NewReader(bytes.NewReader(body)), maxOutputBytes)
		if err != nil {
			return nil, false, false
		}
		return data, truncated, true
	default:
		return nil, false, false
	}
}

func normalizedEncodings(contentEncoding string) []string {
	if contentEncoding == "" {
		return nil
	}

	parts := strings.Split(contentEncoding, ",")
	tokens := make([]string, 0, len(parts))
	for _, part := range parts {
		token := strings.ToLower(strings.TrimSpace(part))
		if token != "" && token != "identity" {
			tokens = append(tokens, token)
		}
	}
	return tokens
}

func readAllLimited(r io.Reader, max int64) ([]byte, bool, error) {
	if max <= 0 {
		return nil, false, nil
	}

	data, err := io.ReadAll(io.LimitReader(r, max+1))
	if err != nil {
		return nil, false, err
	}
	if int64(len(data)) <= max {
		return data, false, nil
	}
	return data[:max], true, nil
}

func sanitizeText(text string, trimLargeBase64 bool) string {
	if !trimLargeBase64 {
		return text
	}

	return b64Regex.ReplaceAllStringFunc(text, func(match string) string {
		if len(match) <= 200 {
			return match
		}
		return match[:200]
	})
}

func isProbablyText(contentType string) bool {
	if contentType == "" {
		return false
	}

	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		mediaType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	}
	mediaType = strings.ToLower(mediaType)

	if strings.HasPrefix(mediaType, "text/") {
		return true
	}
	if mediaType == "application/json" ||
		mediaType == "application/xml" ||
		mediaType == "application/x-www-form-urlencoded" {
		return true
	}
	if strings.HasSuffix(mediaType, "+json") || strings.HasSuffix(mediaType, "+xml") {
		return true
	}
	return false
}
