package store

import (
	"database/sql"
)

type Store struct {
	DB *sql.DB
}

func NewFromEnv() (*Store, error) {
	path := DBPathFromEnv()

	db, err := OpenDB(path)
	if err != nil {
		return nil, err
	}

	if err := InitSchema(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	return &Store{DB: db}, nil
}
