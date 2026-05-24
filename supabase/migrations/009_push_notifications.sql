-- 009_push_notifications.sql
-- Setup for Web Push Notifications

-- 0. Enable the pg_net extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 1. Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, subscription)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions (Safe re-run)
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Database Webhooks (Triggers for Push)
-- Note: Replace 'your-project.supabase.co' with your actual project URL

-- Trigger for Attendance
CREATE OR REPLACE FUNCTION public.notify_attendance_push()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json', 
        'Authorization', 'Bearer ' || current_setting('request.headers')::jsonb->>'authorization'
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

DROP TRIGGER IF EXISTS on_attendance_created ON public.attendance;
CREATE TRIGGER on_attendance_created
  AFTER INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_push();

-- Trigger for Marks
CREATE OR REPLACE FUNCTION public.notify_marks_push()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json', 
        'Authorization', 'Bearer ' || current_setting('request.headers')::jsonb->>'authorization'
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

DROP TRIGGER IF EXISTS on_marks_created ON public.student_marks;
CREATE TRIGGER on_marks_created
  AFTER INSERT ON public.student_marks
  FOR EACH ROW EXECUTE FUNCTION public.notify_marks_push();
