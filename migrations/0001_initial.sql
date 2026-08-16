CREATE TABLE favorites (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    url TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    icon_mode TEXT NOT NULL DEFAULT 'auto'
        CHECK (icon_mode IN ('auto', 'upload', 'fallback')),
    icon_url TEXT,
    icon_storage_key TEXT,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX favorites_enabled_position_idx
    ON favorites (enabled, position);
