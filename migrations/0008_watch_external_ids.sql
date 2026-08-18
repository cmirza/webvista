ALTER TABLE watch_items ADD COLUMN tmdb_id INTEGER;
ALTER TABLE watch_items ADD COLUMN imdb_id TEXT;

CREATE INDEX watch_tmdb_id_idx ON watch_items (tmdb_id);
CREATE INDEX watch_imdb_id_idx ON watch_items (imdb_id);
