package storage

import (
	"strings"

	"github.com/paopaoandlingyia/PrismCat/internal/config"
	"github.com/paopaoandlingyia/PrismCat/internal/httpbody"
)

// PrepareLogForPersistence converts raw captured bodies into their persisted
// display form before the async worker writes them to storage.
func PrepareLogForPersistence(logEntry *RequestLog, cfg *config.Config) {
	if logEntry == nil || cfg == nil {
		return
	}

	loggingCfg := cfg.LoggingSnapshot()

	var requestFormattedTruncated bool
	if len(logEntry.RequestBodyRaw) > 0 {
		logEntry.RequestBody, requestFormattedTruncated = formatCapturedBody(
			logEntry.RequestBodyRaw,
			firstHeaderValue(logEntry.RequestHeaders, "Content-Type"),
			firstHeaderValue(logEntry.RequestHeaders, "Content-Encoding"),
			loggingCfg.MaxRequestBody,
			!loggingCfg.StoreBase64,
		)
	}

	var responseFormattedTruncated bool
	if len(logEntry.ResponseBodyRaw) > 0 {
		logEntry.ResponseBody, responseFormattedTruncated = formatCapturedBody(
			logEntry.ResponseBodyRaw,
			firstHeaderValue(logEntry.ResponseHeaders, "Content-Type"),
			firstHeaderValue(logEntry.ResponseHeaders, "Content-Encoding"),
			loggingCfg.MaxResponseBody,
			!loggingCfg.StoreBase64,
		)
	}

	logEntry.Truncated = logEntry.Truncated ||
		logEntry.RequestBodyCaptureTruncated ||
		logEntry.ResponseBodyCaptureTruncated ||
		requestFormattedTruncated ||
		responseFormattedTruncated

	logEntry.RequestBodyRaw = nil
	logEntry.ResponseBodyRaw = nil
	logEntry.RequestBodyCaptureTruncated = false
	logEntry.ResponseBodyCaptureTruncated = false
}

func formatCapturedBody(body []byte, contentType string, contentEncoding string, maxOutputBytes int64, trimLargeBase64 bool) (string, bool) {
	if len(body) == 0 {
		return "", false
	}

	formatted := httpbody.FormatForDisplay(contentType, contentEncoding, body, httpbody.FormatOptions{
		MaxOutputBytes:  maxOutputBytes,
		TrimLargeBase64: trimLargeBase64,
	})

	return formatted.Text, formatted.Truncated
}

func firstHeaderValue(headers map[string][]string, key string) string {
	if headers == nil {
		return ""
	}
	if vv, ok := headers[key]; ok && len(vv) > 0 {
		return vv[0]
	}
	for k, vv := range headers {
		if strings.EqualFold(k, key) && len(vv) > 0 {
			return vv[0]
		}
	}
	return ""
}
