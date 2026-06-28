-- 021_subject_papers_per_level_and_paper_selection.sql
-- Update subject papers to be per level, add paper id to marks

-- 1. Add level column to subject_paper_configs table
ALTER TABLE public.subject_paper_configs
ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('O', 'A'));

-- 2. Update unique constraint to include level
ALTER TABLE public.subject_paper_configs
DROP CONSTRAINT IF EXISTS subject_paper_configs_subject_id_school_id_paper_name_key;
ALTER TABLE public.subject_paper_configs
ADD CONSTRAINT subject_paper_configs_subject_id_school_id_level_paper_name_key 
UNIQUE(subject_id, school_id, level, paper_name);

-- 3. Add paper config id to student_marks table
ALTER TABLE public.student_marks
ADD COLUMN IF NOT EXISTS subject_paper_config_id UUID REFERENCES public.subject_paper_configs(id);
