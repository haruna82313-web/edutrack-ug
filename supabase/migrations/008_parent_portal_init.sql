-- 008_parent_portal_init.sql
-- Initialize database schema for Parent Portal, School Policies, and Admin Approvals

-- 1. Extend users table for parent support
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Set existing users to approved
UPDATE public.users SET approval_status = 'approved' WHERE approval_status IS NULL;

-- 2. Create School Policies table
CREATE TABLE IF NOT EXISTS public.school_policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    policy_type TEXT DEFAULT 'general_rules' CHECK (policy_type IN ('general_rules', 'privacy_policy', 'usage_terms')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(school_id, policy_type)
);

-- 3. RLS for School Policies
ALTER TABLE public.school_policies ENABLE ROW LEVEL SECURITY;

-- Admins can manage their school policies
CREATE POLICY "Admins manage school policies" ON public.school_policies
    FOR ALL TO authenticated
    USING (public.get_my_role() = 'admin' AND school_id = public.get_my_school())
    WITH CHECK (public.get_my_role() = 'admin' AND school_id = public.get_my_school());

-- Parents and Teachers can view policies for their school
CREATE POLICY "Members can view school policies" ON public.school_policies
    FOR SELECT TO authenticated
    USING (school_id = public.get_my_school());

-- 4. Secure Parent-Student Linking
-- We will query students by parent_phone, but we need to ensure parents can only see THEIR students
-- We'll use a VIEW or a secure function for this later, but for now, let's update RLS on students

-- Update student RLS to allow parents to see their own children
DROP POLICY IF EXISTS "edutrack_students_school" ON public.students;
CREATE POLICY "edutrack_students_school" ON public.students
    FOR ALL TO authenticated
    USING (
        (public.get_my_role() IN ('admin', 'teacher') AND school_id = public.get_my_school()) OR
        (public.get_my_role() = 'parent' AND parent_phone = (SELECT phone_number FROM public.users WHERE id = auth.uid()))
    );

-- 5. Helper Function for Admin Notification (The Pulse)
CREATE OR REPLACE FUNCTION public.get_pending_parent_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT count(*) FROM public.users 
  WHERE role = 'parent' 
  AND approval_status = 'pending' 
  AND school_id = public.get_my_school();
$$;
