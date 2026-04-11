package storage

import (
	"database/sql"
	"path/filepath"
	"sort"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestSQLiteRepositoryListLogsUsesInstantForTimezoneConsistentFiltering(t *testing.T) {
	repo := mustNewSQLiteRepoForTest(t)
	defer repo.Close()

	loc := time.FixedZone("CST", 8*60*60)
	first := time.Date(2026, 3, 23, 17, 23, 21, 797069000, loc)
	second := first.Add(2 * time.Hour)

	if err := repo.SaveLog(newTestLog("l1", first)); err != nil {
		t.Fatalf("save first log: %v", err)
	}
	if err := repo.SaveLog(newTestLog("l2", second)); err != nil {
		t.Fatalf("save second log: %v", err)
	}

	localPivot := first
	utcPivot := first.UTC()

	localLogs, localTotal, err := repo.ListLogs(LogFilter{
		StartTime: &localPivot,
		Limit:     10,
	})
	if err != nil {
		t.Fatalf("list logs with local pivot: %v", err)
	}
	utcLogs, utcTotal, err := repo.ListLogs(LogFilter{
		StartTime: &utcPivot,
		Limit:     10,
	})
	if err != nil {
		t.Fatalf("list logs with UTC pivot: %v", err)
	}

	if localTotal != 2 || utcTotal != 2 {
		t.Fatalf("unexpected totals: local=%d utc=%d, want both 2", localTotal, utcTotal)
	}
	if len(localLogs) != len(utcLogs) {
		t.Fatalf("different result sizes: local=%d utc=%d", len(localLogs), len(utcLogs))
	}

	localIDs := make([]string, 0, len(localLogs))
	for _, lg := range localLogs {
		localIDs = append(localIDs, lg.ID)
	}
	utcIDs := make([]string, 0, len(utcLogs))
	for _, lg := range utcLogs {
		utcIDs = append(utcIDs, lg.ID)
	}
	sort.Strings(localIDs)
	sort.Strings(utcIDs)
	for i := range localIDs {
		if localIDs[i] != utcIDs[i] {
			t.Fatalf("different result ids: local=%v utc=%v", localIDs, utcIDs)
		}
	}

	for _, lg := range utcLogs {
		if lg.CreatedAt.Location() != time.UTC {
			t.Fatalf("created_at location should be UTC, got %v", lg.CreatedAt.Location())
		}
	}
}

func TestSQLiteRepositoryMigrationBackfillsCreatedAtUnixMS(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "prismcat.db")

	repo, err := NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("create repo: %v", err)
	}

	loc := time.FixedZone("CST", 8*60*60)
	baseTime := time.Date(2026, 3, 24, 9, 30, 0, 123000000, loc)
	if err := repo.SaveLog(newTestLog("legacy", baseTime)); err != nil {
		t.Fatalf("save log: %v", err)
	}

	// Simulate legacy/missing data so startup migration must backfill.
	if _, err := repo.db.Exec("UPDATE request_logs SET created_at_unix_ms = 0 WHERE id = ?", "legacy"); err != nil {
		t.Fatalf("set created_at_unix_ms=0: %v", err)
	}

	if err := repo.Close(); err != nil {
		t.Fatalf("close repo: %v", err)
	}

	reopened, err := NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("reopen repo: %v", err)
	}
	defer reopened.Close()

	var unixMS int64
	if err := reopened.db.QueryRow("SELECT created_at_unix_ms FROM request_logs WHERE id = ?", "legacy").Scan(&unixMS); err != nil {
		t.Fatalf("query backfilled created_at_unix_ms: %v", err)
	}
	want := baseTime.UTC().UnixMilli()
	if unixMS != want {
		t.Fatalf("backfilled created_at_unix_ms=%d, want %d", unixMS, want)
	}

	pivot := baseTime.UTC()
	logs, total, err := reopened.ListLogs(LogFilter{
		StartTime: &pivot,
		Limit:     10,
	})
	if err != nil {
		t.Fatalf("list logs after migration: %v", err)
	}
	if total != 1 || len(logs) != 1 || logs[0].ID != "legacy" {
		t.Fatalf("unexpected query result after migration: total=%d len=%d ids=%v", total, len(logs), extractLogIDs(logs))
	}
}

func TestSQLiteRepositoryMigratesLegacyTableWithoutCreatedAtUnixMS(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "legacy.db")

	legacyDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open legacy db: %v", err)
	}

	legacySchema := `
	CREATE TABLE request_logs (
		id TEXT PRIMARY KEY,
		created_at DATETIME NOT NULL,
		upstream TEXT NOT NULL,
		target_url TEXT NOT NULL,
		method TEXT NOT NULL,
		path TEXT NOT NULL,
		query TEXT,
		request_headers TEXT,
		request_body TEXT,
		request_body_size INTEGER DEFAULT 0,
		status_code INTEGER DEFAULT 0,
		response_headers TEXT,
		response_body TEXT,
		response_body_size INTEGER DEFAULT 0,
		streaming INTEGER DEFAULT 0,
		latency_ms INTEGER DEFAULT 0,
		error TEXT,
		truncated INTEGER DEFAULT 0
	);
	CREATE INDEX IF NOT EXISTS idx_logs_created_at ON request_logs(created_at DESC);
	`
	if _, err := legacyDB.Exec(legacySchema); err != nil {
		_ = legacyDB.Close()
		t.Fatalf("create legacy schema: %v", err)
	}
	if _, err := legacyDB.Exec(`
		INSERT INTO request_logs (
			id, created_at, upstream, target_url, method, path, query, request_headers, request_body,
			request_body_size, status_code, response_headers, response_body, response_body_size, streaming,
			latency_ms, error, truncated
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		"legacy-1", "2026-04-08 22:10:10 +0800 CST", "openai", "https://api.openai.com/v1/responses",
		"POST", "/v1/responses", "", "{}", "", 0, 200, "{}", "", 0, 0, 12, "", 0,
	); err != nil {
		_ = legacyDB.Close()
		t.Fatalf("insert legacy row: %v", err)
	}
	if err := legacyDB.Close(); err != nil {
		t.Fatalf("close legacy db: %v", err)
	}

	repo, err := NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("migrate legacy db: %v", err)
	}
	defer repo.Close()

	var unixMS int64
	if err := repo.db.QueryRow("SELECT created_at_unix_ms FROM request_logs WHERE id = ?", "legacy-1").Scan(&unixMS); err != nil {
		t.Fatalf("query created_at_unix_ms after migration: %v", err)
	}
	if unixMS <= 0 {
		t.Fatalf("created_at_unix_ms should be backfilled, got %d", unixMS)
	}

	var idxCount int
	if err := repo.db.QueryRow("SELECT COUNT(*) FROM pragma_index_list('request_logs') WHERE name = 'idx_logs_created_at_unix_ms'").Scan(&idxCount); err != nil {
		t.Fatalf("query created_at_unix_ms index: %v", err)
	}
	if idxCount != 1 {
		t.Fatalf("idx_logs_created_at_unix_ms missing after migration")
	}
}

func mustNewSQLiteRepoForTest(t *testing.T) *SQLiteRepository {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "prismcat.db")
	repo, err := NewSQLiteRepository(dbPath)
	if err != nil {
		t.Fatalf("create sqlite repo: %v", err)
	}
	return repo
}

func newTestLog(id string, createdAt time.Time) *RequestLog {
	return &RequestLog{
		ID:        id,
		CreatedAt: createdAt,
		Upstream:  "openai",
		TargetURL: "https://api.openai.com/v1/responses",
		Method:    "POST",
		Path:      "/v1/responses",
	}
}

func extractLogIDs(logs []*RequestLog) []string {
	ids := make([]string, 0, len(logs))
	for _, lg := range logs {
		ids = append(ids, lg.ID)
	}
	return ids
}
