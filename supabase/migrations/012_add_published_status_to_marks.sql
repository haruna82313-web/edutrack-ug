-- 012_add_published_status_to_marks.sql
-- Add is_published column to student_marks to allow admins to control visibility

ALTER TABLE public.student_marks 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- Update the push notification trigger to only fire when is_published is set to true
-- This ensures parents are notified only when the marks are officially released.

CREATE OR REPLACE FUNCTION public.notify_marks_push()
RETURNS TRIGGER AS $$
DECLARE
  auth_header TEXT;
  project_url TEXT;
BEGIN
  -- Safely get the authorization header, return NULL if missing or invalid
  BEGIN
    auth_header := current_setting('request.headers', true)::jsonb->>'authorization';
  EXCEPTION WHEN OTHERS THEN
    auth_header := NULL;
  END;

  -- Only notify if the record is being published (either on insert with is_published=true 
  -- or on update when is_published changes from false to true)
  IF (TG_OP = 'INSERT' AND NEW.is_published = TRUE) OR 
     (TG_OP = 'UPDATE' AND OLD.is_published = FALSE AND NEW.is_published = TRUE) THEN
    
    -- Dynamically build project URL if possible, otherwise use a placeholder
    BEGIN
      project_url := 'https://' || (SELECT split_part(current_setting('request.headers', true)::jsonb->>'host', '.', 1) || '.supabase.co');
    EXCEPTION WHEN OTHERS THEN
      project_url := 'https://your-project.supabase.co'; -- Fallback
    END;

    PERFORM
      net.http_post(
        url := project_url || '/functions/v1/push-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json', 
          'Authorization', COALESCE(auth_header, '')
        ),
        body := jsonb_build_object(
          'record', row_to_json(NEW),
          'table', 'student_marks',
          'type', 'PUBLISH'
        )
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger to handle updates as well
DROP TRIGGER IF EXISTS on_marks_created ON public.student_marks;
DROP TRIGGER IF EXISTS on_marks_published ON public.student_marks;
CREATE TRIGGER on_marks_published
  AFTER INSERT OR UPDATE ON public.student_marks
  FOR EACH ROW EXECUTE FUNCTION public.notify_marks_push();
