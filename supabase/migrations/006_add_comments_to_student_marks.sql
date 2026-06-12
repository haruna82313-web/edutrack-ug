-- 006_add_comments_to_student_marks.sql
-- Add comments column to student_marks table

ALTER TABLE public.student_marks 
ADD COLUMN IF NOT EXISTS comments TEXT;

-- Optional: Add index for better performance if needed
-- CREATE INDEX IF NOT EXISTS idx_marks_comments ON public.student_marks(comments);
