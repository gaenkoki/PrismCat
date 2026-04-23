package storage

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/paopaoandlingyia/PrismCat/internal/config"
)

type memRepo struct {
	mu     sync.Mutex
	closed bool
	logs   []*RequestLog
}

func (m *memRepo) SaveLog(log *RequestLog) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return errors.New("closed")
	}
	if log == nil {
		return nil
	}
	m.logs = append(m.logs, log)
	return nil
}

func (m *memRepo) GetLog(id string) (*RequestLog, error) { return nil, errors.New("not implemented") }
func (m *memRepo) ListLogs(filter LogFilter) ([]*RequestLog, int64, error) {
	return nil, 0, errors.New("not implemented")
}
func (m *memRepo) DeleteLog(id string) error                        { return nil }
func (m *memRepo) DeleteLogs(ids []string) (int64, error)           { return int64(len(ids)), nil }
func (m *memRepo) DeleteLogsBefore(before time.Time) (int64, error) { return 0, nil }
func (m *memRepo) GetStats(since *time.Time) (*LogStats, error)     { return &LogStats{}, nil }
func (m *memRepo) Close() error                                     { m.mu.Lock(); m.closed = true; m.mu.Unlock(); return nil }

func TestAsyncRepositoryCloseDrainsQueue(t *testing.T) {
	inner := &memRepo{}
	a := NewAsyncRepository(inner, nil, 64)

	const n = 10
	for i := 0; i < n; i++ {
		if err := a.SaveLog(&RequestLog{ID: "id"}); err != nil {
			t.Fatalf("SaveLog failed: %v", err)
		}
	}

	if err := a.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	inner.mu.Lock()
	got := len(inner.logs)
	inner.mu.Unlock()

	if got != n {
		t.Fatalf("inner.SaveLog called %d times, want %d", got, n)
	}
}

func TestAsyncRepositoryCloseConcurrentSaveDoesNotPanic(t *testing.T) {
	inner := &memRepo{}
	a := NewAsyncRepository(inner, nil, 1024)

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				err := a.SaveLog(&RequestLog{ID: "id"})
				if err == ErrAsyncClosed {
					return
				}
			}
		}()
	}

	// Let the producers run briefly, then close while they are active.
	time.Sleep(10 * time.Millisecond)
	if err := a.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}
	wg.Wait()
}

func TestAsyncRepositoryPreparesBodiesInWorker(t *testing.T) {
	inner := &memRepo{}
	cfg := &config.Config{}
	cfg.Logging.MaxRequestBody = 1024
	cfg.Logging.MaxResponseBody = 1024
	cfg.Logging.StoreBase64 = true

	a := NewAsyncRepository(inner, cfg, 16)

	err := a.SaveLog(&RequestLog{
		ID:             "id",
		RequestHeaders: map[string][]string{"Content-Type": {"application/json"}},
		RequestBodyRaw: []byte(`{"hello":"world"}`),
	})
	if err != nil {
		t.Fatalf("SaveLog failed: %v", err)
	}
	if err := a.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	inner.mu.Lock()
	defer inner.mu.Unlock()
	if len(inner.logs) != 1 {
		t.Fatalf("inner logs = %d, want 1", len(inner.logs))
	}
	saved := inner.logs[0]
	if !strings.Contains(saved.RequestBody, `"hello":"world"`) {
		t.Fatalf("RequestBody = %q, want formatted JSON content", saved.RequestBody)
	}
	if saved.RequestBodyRaw != nil {
		t.Fatalf("RequestBodyRaw not cleared")
	}
}
