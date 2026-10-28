-- 013_add_ai_screening_to_applications.sql
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS ai_score INT,
ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(50),
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_strengths JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_weaknesses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ai_screened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_applications_ai_score ON applications(ai_score DESC NULLS LAST);
