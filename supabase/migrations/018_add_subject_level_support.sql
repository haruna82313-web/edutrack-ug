-- 018_add_subject_level_support.sql
-- Add subject level to distinguish O-Level and A-Level subjects

-- Add level column to subjects table
ALTER TABLE public.subjects 
ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('O', 'A'));

-- Enable RLS if not already enabled
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
