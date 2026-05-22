-- 006_add_leadership_role_to_students.sql
-- Add leadership_role column to students table

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS leadership_role TEXT;
