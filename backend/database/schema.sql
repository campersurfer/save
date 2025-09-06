-- Main content table for all saved items
CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('article', 'tweet', 'image', 'video', 'instagram', 'tiktok')),
    title TEXT,
    author TEXT,
    content TEXT,
    extracted_at INTEGER NOT NULL,
    saved_at INTEGER NOT NULL DEFAULT (unixepoch()),
    read_at INTEGER,
    archived INTEGER DEFAULT 0,
    favorite INTEGER DEFAULT 0,
    
    -- Visual features
    dominant_color TEXT,
    mood TEXT CHECK(mood IN ('light', 'dark', 'warm', 'cool', 'neutral')),
    temperature REAL,
    contrast REAL,
    saturation REAL,
    
    -- Metadata
    duration_seconds INTEGER, -- for videos/articles (reading time)
    word_count INTEGER,
    language TEXT DEFAULT 'en',
    source_domain TEXT,
    
    -- User organization
    folder_id TEXT,
    tags TEXT, -- JSON array of tags
    notes TEXT,
    
    -- Extraction metadata
    extraction_method TEXT,
    extraction_success INTEGER DEFAULT 1,
    extraction_errors TEXT, -- JSON array of errors if any
    
    -- Sync metadata
    last_synced INTEGER,
    sync_version INTEGER DEFAULT 1,
    device_id TEXT,
    
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- Folders for organization
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    parent_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    position INTEGER DEFAULT 0,
    
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Media table for images/videos associated with content
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('image', 'video', 'audio')),
    url TEXT NOT NULL,
    local_path TEXT,
    thumbnail_path TEXT,
    width INTEGER,
    height INTEGER,
    duration_seconds REAL,
    size_bytes INTEGER,
    mime_type TEXT,
    position INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Reading progress tracking
CREATE TABLE IF NOT EXISTS reading_progress (
    content_id TEXT PRIMARY KEY,
    current_position INTEGER DEFAULT 0, -- character position for text, seconds for audio/video
    total_length INTEGER,
    progress_percentage REAL DEFAULT 0,
    last_read_at INTEGER,
    reading_time_seconds INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Queue for continuous reading/listening
CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (unixepoch()),
    played_at INTEGER,
    
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    UNIQUE(content_id)
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Search history
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    results_count INTEGER,
    clicked_result_id TEXT,
    searched_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Extraction cache to avoid re-extracting
CREATE TABLE IF NOT EXISTS extraction_cache (
    url TEXT PRIMARY KEY,
    content_id TEXT,
    extracted_data TEXT, -- JSON blob
    extracted_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER,
    
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE SET NULL
);

-- Sync operations log
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL CHECK(operation IN ('push', 'pull', 'conflict')),
    content_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER,
    device_id TEXT,
    
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE SET NULL
);

-- Full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
    title,
    author,
    content,
    tags,
    notes,
    content=content,
    content_rowid=rowid,
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS content_ai AFTER INSERT ON content BEGIN
    INSERT INTO content_fts(rowid, title, author, content, tags, notes)
    VALUES (new.rowid, new.title, new.author, new.content, new.tags, new.notes);
END;

CREATE TRIGGER IF NOT EXISTS content_ad AFTER DELETE ON content BEGIN
    DELETE FROM content_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS content_au AFTER UPDATE ON content BEGIN
    UPDATE content_fts 
    SET title = new.title,
        author = new.author,
        content = new.content,
        tags = new.tags,
        notes = new.notes
    WHERE rowid = new.rowid;
END;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
CREATE INDEX IF NOT EXISTS idx_content_saved_at ON content(saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_archived ON content(archived);
CREATE INDEX IF NOT EXISTS idx_content_favorite ON content(favorite);
CREATE INDEX IF NOT EXISTS idx_content_folder ON content(folder_id);
CREATE INDEX IF NOT EXISTS idx_content_mood ON content(mood);
CREATE INDEX IF NOT EXISTS idx_content_dominant_color ON content(dominant_color);
CREATE INDEX IF NOT EXISTS idx_content_source_domain ON content(source_domain);
CREATE INDEX IF NOT EXISTS idx_content_sync ON content(last_synced, sync_version);

CREATE INDEX IF NOT EXISTS idx_media_content ON media(content_id);
CREATE INDEX IF NOT EXISTS idx_queue_position ON queue(position);
CREATE INDEX IF NOT EXISTS idx_extraction_cache_expires ON extraction_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status, started_at);

-- Views for common queries
CREATE VIEW IF NOT EXISTS v_unread_articles AS
SELECT * FROM content 
WHERE type = 'article' 
  AND read_at IS NULL 
  AND archived = 0
ORDER BY saved_at DESC;

CREATE VIEW IF NOT EXISTS v_favorites AS
SELECT * FROM content 
WHERE favorite = 1 
  AND archived = 0
ORDER BY saved_at DESC;

CREATE VIEW IF NOT EXISTS v_queue_items AS
SELECT c.*, q.position, q.added_at as queued_at
FROM queue q
JOIN content c ON q.content_id = c.id
ORDER BY q.position;

CREATE VIEW IF NOT EXISTS v_content_with_media AS
SELECT c.*,
       GROUP_CONCAT(m.url) as media_urls,
       COUNT(m.id) as media_count
FROM content c
LEFT JOIN media m ON c.id = m.content_id
GROUP BY c.id;

-- Export requests for GDPR compliance
CREATE TABLE IF NOT EXISTS export_requests (
    id TEXT PRIMARY KEY,
    export_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER,
    metadata TEXT, -- JSON metadata about the export
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    file_path TEXT,
    download_count INTEGER DEFAULT 0,
    expires_at INTEGER
);

-- Deletion requests for GDPR compliance  
CREATE TABLE IF NOT EXISTS deletion_requests (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
    scheduled_for INTEGER NOT NULL,
    processed_at INTEGER,
    completed_at INTEGER,
    cancelled_at INTEGER,
    reason TEXT,
    items TEXT, -- JSON of what to delete
    status TEXT DEFAULT 'pending', -- pending, processing, completed, cancelled, failed
    verification_token TEXT NOT NULL,
    error_message TEXT
);

-- Privacy consent tracking
CREATE TABLE IF NOT EXISTS privacy_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    consent_type TEXT NOT NULL, -- analytics, marketing, cookies, etc.
    granted INTEGER NOT NULL, -- SQLite uses INTEGER for boolean
    granted_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    ip_address TEXT,
    user_agent TEXT,
    UNIQUE(user_id, consent_type)
);

-- DMCA audit log
CREATE TABLE IF NOT EXISTS dmca_audit_log (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL, -- takedown_request, counter_notice, content_removed, content_restored
    content_id TEXT,
    user_id TEXT,
    requester_info TEXT, -- JSON of requester details
    details TEXT, -- JSON of action details
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    ip_address TEXT
);

-- Additional indexes for compliance tables
CREATE INDEX IF NOT EXISTS idx_export_requests_user ON export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_export_requests_status ON export_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled ON deletion_requests(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_privacy_consents_user ON privacy_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_dmca_audit_content ON dmca_audit_log(content_id);
CREATE INDEX IF NOT EXISTS idx_dmca_audit_user ON dmca_audit_log(user_id);