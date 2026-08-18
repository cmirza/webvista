CREATE TABLE watch_items (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    year INTEGER CHECK (year IS NULL OR year BETWEEN 1888 AND 2100),
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    poster_url TEXT,
    service_name TEXT NOT NULL CHECK (length(trim(service_name)) > 0),
    watch_url TEXT NOT NULL CHECK (length(trim(watch_url)) > 0),
    position INTEGER NOT NULL CHECK (position >= 0),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX watch_enabled_position_idx
    ON watch_items (enabled, position);
