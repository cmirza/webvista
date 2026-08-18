CREATE TABLE for_you_items (
    id TEXT PRIMARY KEY NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    image_url TEXT,
    source_name TEXT NOT NULL CHECK (length(trim(source_name)) > 0),
    position INTEGER NOT NULL CHECK (position >= 0),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX for_you_enabled_position_idx
    ON for_you_items (enabled, position);
