package storage

import (
	"context"
	"log"
	"strings"
	"unicode/utf8"
	"unsafe"

	"github.com/paopaoandlingyia/PrismCat/internal/config"
)

// DetachLargeBodies best-effort detaches oversized captured bodies into blob
// storage and shrinks inline previews before the log is queued or persisted.
func DetachLargeBodies(logEntry *RequestLog, blobs BlobStore, cfg *config.Config) {
	if blobs == nil || cfg == nil || logEntry == nil {
		return
	}

	logging := cfg.LoggingSnapshot()
	detachOver := logging.DetachBodyOverBytes
	if detachOver <= 0 {
		return
	}
	previewBytes := logging.BodyPreviewBytes
	ctx := context.Background()

	if logEntry.RequestBodyRef == "" && int64(len(logEntry.RequestBody)) > detachOver {
		ref, err := blobs.Put(ctx, stringBytes(logEntry.RequestBody))
		if err != nil {
			log.Printf("blob put (request) failed: %v", err)
		} else {
			logEntry.RequestBodyRef = ref
			logEntry.RequestBody = truncateUTF8(logEntry.RequestBody, previewBytes)
		}
	}

	if logEntry.ResponseBodyRef == "" && int64(len(logEntry.ResponseBody)) > detachOver {
		ref, err := blobs.Put(ctx, stringBytes(logEntry.ResponseBody))
		if err != nil {
			log.Printf("blob put (response) failed: %v", err)
		} else {
			logEntry.ResponseBodyRef = ref
			logEntry.ResponseBody = truncateUTF8(logEntry.ResponseBody, previewBytes)
		}
	}
}

func truncateUTF8(s string, maxBytes int64) string {
	if maxBytes <= 0 {
		return ""
	}
	if int64(len(s)) <= maxBytes {
		return s
	}

	cut := int(maxBytes)
	if cut > len(s) {
		cut = len(s)
	}
	for cut > 0 && (s[cut]&0xC0) == 0x80 {
		cut--
	}
	for cut > 0 && !utf8.ValidString(s[:cut]) {
		cut--
		for cut > 0 && (s[cut]&0xC0) == 0x80 {
			cut--
		}
	}
	return strings.Clone(s[:cut])
}

func stringBytes(s string) []byte {
	if s == "" {
		return nil
	}
	return unsafe.Slice(unsafe.StringData(s), len(s))
}
