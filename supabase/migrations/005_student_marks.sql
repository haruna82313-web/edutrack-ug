-- 005_student_marks.sql
-- Create student_marks table to track academic performance

CREATE TABLE IF NOT EXISTS public.student_marks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    marks NUMERIC(5,2) NOT NULL,
    max_marks NUMERIC(5,2) DEFAULT 100.00,
    term TEXT,
    year INTEGER DEFAULT 2026,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.student_marks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything in their school
CREATE POLICY "Admins full access to marks" ON public.student_marks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
            AND users.school_id = student_marks.school_id
        )
    );

-- Teachers can insert/view marks in their school
CREATE POLICY "Teachers can manage marks" ON public.student_marks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'teacher'
            AND users.school_id = student_marks.school_id
        )
    );

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_marks_student ON public.student_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_school ON public.student_marks(school_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON public.student_marks(subject_id);
