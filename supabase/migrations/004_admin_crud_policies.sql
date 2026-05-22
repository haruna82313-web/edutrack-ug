-- Fix: admins can UPDATE and DELETE school data (RLS was often blocking deletes).
-- Run entire file in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.auth_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_school_id() TO authenticated;

-- Helper: one policy per table (SELECT + INSERT + UPDATE + DELETE for same school)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'students', 'classes', 'subjects', 'lessons', 'attendance',
    'syllabus_topics', 'teacher_invites'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS edutrack_%s_school ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY edutrack_%s_school ON public.%I FOR ALL TO authenticated USING (school_id = public.auth_user_school_id()) WITH CHECK (school_id = public.auth_user_school_id())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Timetables (optional tables)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'timetables') THEN
    ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS edutrack_timetables_school ON public.timetables;
    CREATE POLICY edutrack_timetables_school ON public.timetables
      FOR ALL TO authenticated
      USING (school_id = public.auth_user_school_id())
      WITH CHECK (school_id = public.auth_user_school_id());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'timetable_slots') THEN
    ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS edutrack_timetable_slots_school ON public.timetable_slots;
    CREATE POLICY edutrack_timetable_slots_school ON public.timetable_slots
      FOR ALL TO authenticated
      USING (
        timetable_id IN (
          SELECT id FROM public.timetables WHERE school_id = public.auth_user_school_id()
        )
      )
      WITH CHECK (
        timetable_id IN (
          SELECT id FROM public.timetables WHERE school_id = public.auth_user_school_id()
        )
      );
  END IF;
END $$;

-- School documents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'school_documents') THEN
    ALTER TABLE public.school_documents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "School members manage documents" ON public.school_documents;
    DROP POLICY IF EXISTS edutrack_school_documents_school ON public.school_documents;
    CREATE POLICY edutrack_school_documents_school ON public.school_documents
      FOR ALL TO authenticated
      USING (school_id = public.auth_user_school_id())
      WITH CHECK (school_id = public.auth_user_school_id());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.syllabus_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_invites TO authenticated;
