CREATE TABLE portal_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO portal_settings (key, value, updated_at)
VALUES ('for_you_enabled', '1', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
