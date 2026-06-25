-- 019: Student Subject Assignment & Report Card Persistence
-- This migration adds support for assigning specific subjects to individual students
-- and ensures proper report card storage with permanent access for parents

-- 1. Create student_subjects table for subject assignments
CREATE TABLE IF NOT EXISTS public.student_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, school_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON public.student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject ON public.student_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_school ON public.student_subjects(school_id);

-- 2. Enable RLS and create policies
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

-- School members can manage student subject assignments
CREATE POLICY "School members can manage student subjects"
  ON public.student_subjects
  FOR ALL
  USING (school_id = public.auth_user_school_id())
  WITH CHECK (school_id = public.auth_user_school_id());

-- 3. Enhance student_reports table with proper RLS policies
CREATE POLICY "Parents can view their children's reports"
  ON public.student_reports
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM public.students 
      WHERE parent_phone = (
        SELECT phone_number FROM public.users WHERE id = auth.uid()
      )
    )
    OR
    school_id = public.auth_user_school_id()
  );

CREATE POLICY "School members can manage student reports"
  ON public.student_reports
  FOR ALL
  USING (school_id = public.auth_user_school_id())
  WITH CHECK (school_id = public.auth_user_school_id());
