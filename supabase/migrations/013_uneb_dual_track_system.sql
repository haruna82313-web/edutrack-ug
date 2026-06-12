-- 013_uneb_dual_track_system.sql
-- UNEB Dual-Track System Migration for EduTrack Uganda

-- 1. Add LIN (Learner Identification Number) to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS lin TEXT UNIQUE;

-- 2. Add level detection to classes (auto-detect S1-S4=O, S5-S6=A)
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('O', 'A'));

-- 3. Extend student_marks for UNEB dual-track
ALTER TABLE public.student_marks 
ADD COLUMN IF NOT EXISTS ca_score NUMERIC(5,2) CHECK (ca_score >= 0 AND ca_score <= 20),
ADD COLUMN IF NOT EXISTS aoi_scores JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS paper_scores JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS calculated_final_subject_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS grade TEXT,
ADD COLUMN IF NOT EXISTS points INTEGER,
ADD COLUMN IF NOT EXISTS result_status TEXT CHECK (result_status IN ('Result 1', 'Result 2', 'Result 3'));

-- 4. Create student_remarks table
CREATE TABLE IF NOT EXISTS public.student_remarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  teacher_comment TEXT,
  head_teacher_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create project_work table
CREATE TABLE IF NOT EXISTS public.project_work (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  score INTEGER CHECK (score >= 1 AND score <= 3),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create generic_skills table
CREATE TABLE IF NOT EXISTS public.generic_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  skills_data JSONB DEFAULT '{}'::jsonb, -- { critical_thinking: "...", collaboration: "...", communication: "..." }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Extend schools table for branding
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS motto TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS current_academic_year TEXT DEFAULT '2026',
ADD COLUMN IF NOT EXISTS current_term TEXT DEFAULT 'Term 1';

-- 8. Create subject_paper_configs table for dynamic paper weighting
CREATE TABLE IF NOT EXISTS public.subject_paper_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  paper_name TEXT NOT NULL,
  max_possible_raw_mark INTEGER NOT NULL CHECK (max_possible_raw_mark > 0),
  paper_weight_percentage NUMERIC(5,2) NOT NULL CHECK (paper_weight_percentage > 0 AND paper_weight_percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, school_id, paper_name)
);

-- 9. Create student_reports table for storing generated reports
CREATE TABLE IF NOT EXISTS public.student_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  report_url TEXT NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- 10. Enable RLS for all new tables
ALTER TABLE public.student_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generic_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_paper_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_reports ENABLE ROW LEVEL SECURITY;

-- 11. Create basic RLS policies (you should expand these based on your exact needs)
CREATE POLICY "School members can view student remarks" ON public.student_remarks FOR SELECT USING (true);
CREATE POLICY "Teachers can insert student remarks" ON public.student_remarks FOR INSERT WITH CHECK (true);
CREATE POLICY "Teachers can update student remarks" ON public.student_remarks FOR UPDATE USING (true);

CREATE POLICY "School members can view project work" ON public.project_work FOR SELECT USING (true);
CREATE POLICY "Teachers can insert project work" ON public.project_work FOR INSERT WITH CHECK (true);

CREATE POLICY "School members can view generic skills" ON public.generic_skills FOR SELECT USING (true);
CREATE POLICY "Teachers can insert generic skills" ON public.generic_skills FOR INSERT WITH CHECK (true);

CREATE POLICY "School members can view paper configs" ON public.subject_paper_configs FOR SELECT USING (true);
CREATE POLICY "Admins can manage paper configs" ON public.subject_paper_configs FOR ALL USING (true);

CREATE POLICY "School members can view student reports" ON public.student_reports FOR SELECT USING (true);
CREATE POLICY "Admins can manage student reports" ON public.student_reports FOR ALL USING (true);
