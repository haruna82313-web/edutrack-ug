-- 010_fix_triggers_and_add_gender.sql
-- 1. Add gender column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female', 'Other'));

-- 2. Add gender column to users table (for teachers and admins)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female', 'Other'));

-- 3. Add gender column to teacher_invites table
ALTER TABLE public.teacher_invites ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female', 'Other'));

-- 4. Fix Push Notification Triggers to handle missing headers gracefully
-- This fixes the "invalid input syntax for type json" error

CREATE OR REPLACE FUNCTION public.notify_attendance_push()
RETURNS TRIGGER AS $$
DECLARE
  auth_header TEXT;
BEGIN
  -- Safely get the authorization header, return NULL if missing or invalid
  BEGIN
    auth_header := current_setting('request.headers', true)::jsonb->>'authorization';
  EXCEPTION WHEN OTHERS THEN
    auth_header := NULL;
  END;

  PERFORM
    net.http_post(
      url := 'https://' || (SELECT split_part(current_setting('request.headers', true)::jsonb->>'host', '.', 1) || '.supabase.co') || '/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json', 
        'Authorization', COALESCE(auth_header, '')
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW),
        'table', 'attendance',
        'type', 'INSERT'
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_marks_push()
RETURNS TRIGGER AS $$
DECLARE
  auth_header TEXT;
BEGIN
  -- Safely get the authorization header, return NULL if missing or invalid
  BEGIN
    auth_header := current_setting('request.headers', true)::jsonb->>'authorization';
  EXCEPTION WHEN OTHERS THEN
    auth_header := NULL;
  END;

  PERFORM
    net.http_post(
      url := 'https://' || (SELECT split_part(current_setting('request.headers', true)::jsonb->>'host', '.', 1) || '.supabase.co') || '/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json', 
        'Authorization', COALESCE(auth_header, '')
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW),
        'table', 'student_marks',
        'type', 'INSERT'
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
