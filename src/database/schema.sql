-- RFP Automation System Database Schema
-- SQLite Schema for production deployment

-- Workflows table to track RFP processing workflows
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    current_step TEXT,
    progress INTEGER DEFAULT 0,
    project_context TEXT, -- JSON
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    duration INTEGER, -- milliseconds
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Documents table to track uploaded and processed documents
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    workflow_id TEXT,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    document_type TEXT, -- 'rfp', 'company_profile', 'case_study', etc.
    processing_status TEXT DEFAULT 'pending',
    processed_content TEXT,
    metadata TEXT, -- JSON
    structured_data TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Workflow results table to store processing results
CREATE TABLE IF NOT EXISTS workflow_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    step_name TEXT NOT NULL,
    result_data TEXT, -- JSON
    confidence_score REAL,
    processing_time INTEGER, -- milliseconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Requirements table to store extracted requirements
CREATE TABLE IF NOT EXISTS requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    requirement_id TEXT,
    category TEXT, -- 'technical', 'business', 'compliance'
    description TEXT NOT NULL,
    priority TEXT, -- 'high', 'medium', 'low'
    complexity TEXT, -- 'high', 'medium', 'low'
    mandatory BOOLEAN DEFAULT FALSE,
    source_document_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE SET NULL
);

-- Questions table to store generated clarification questions
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    question_id TEXT,
    category TEXT, -- 'technical', 'business', 'timeline', 'budget', 'compliance'
    question_text TEXT NOT NULL,
    rationale TEXT,
    priority TEXT, -- 'high', 'medium', 'low'
    impact TEXT,
    related_requirements TEXT, -- JSON array of requirement IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Answers table to store extracted answers
CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    question_id TEXT,
    answer_text TEXT,
    confidence_score REAL,
    answer_type TEXT, -- 'direct', 'inferred', 'partial'
    completeness TEXT, -- 'complete', 'partial', 'incomplete'
    sources TEXT, -- JSON array of source information
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- System settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table for tracking system activities
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT,
    action TEXT NOT NULL,
    details TEXT, -- JSON
    user_id TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    unit TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_workflow_id ON documents(workflow_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_workflow_results_workflow_id ON workflow_results(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_results_step ON workflow_results(step_name);
CREATE INDEX IF NOT EXISTS idx_requirements_workflow_id ON requirements(workflow_id);
CREATE INDEX IF NOT EXISTS idx_requirements_category ON requirements(category);
CREATE INDEX IF NOT EXISTS idx_questions_workflow_id ON questions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_questions_priority ON questions(priority);
CREATE INDEX IF NOT EXISTS idx_answers_workflow_id ON answers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_workflow_id ON audit_log(workflow_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_workflow_id ON performance_metrics(workflow_id);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
('system_version', '1.0.0', 'Current system version'),
('max_file_size', '52428800', 'Maximum file size in bytes (50MB)'),
('allowed_file_types', '["pdf","docx","txt","csv","xlsx","xls"]', 'Allowed file types for upload'),
('default_retry_attempts', '3', 'Default number of retry attempts for failed operations'),
('cleanup_interval', '86400000', 'Cleanup interval in milliseconds (24 hours)'),
('max_workflow_age', '604800000', 'Maximum workflow age before cleanup in milliseconds (7 days)');