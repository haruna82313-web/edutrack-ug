-- 014_add_assessment_type_to_student_marks.sql
-- Add assessment_type column to student_marks table for better filtering

ALTER TABLE public.student_marks 
ADD COLUMN IF NOT EXISTS assessment_type TEXT DEFAULT 'Unspecified';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_marks_assessment_type ON public.student_marks(assessment_type);
