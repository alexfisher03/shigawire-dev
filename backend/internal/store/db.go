package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

const DefaultDBPath = "./data/shigawire.sqlite"

func DBPathFromEnv() string {
	if p := os.Getenv("DB_PATH"); p != "" {
		return p
	}

	return DefaultDBPath
}

func OpenDB(dbPath string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, fmt.Errorf("mkdir db dir: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("db connection resulted in: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := applyPragmas(db); err != nil {
		return nil, err
	}

	return db, nil
}

func applyPragmas(db *sql.DB) error {
	statements := []string{
		"PRAGMA foreign_keys = ON;",
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
	}

	for _, q := range statements {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("pragma failed: %w", err)
		}
	}

	return nil
}
