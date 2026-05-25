-- 011_create_all_teachers_view.sql
-- Create a unified view for both registered teachers and pending invites

CREATE OR REPLACE VIEW public.all_teachers_view AS
SELECT 
    id AS registered_id,
    full_name,
    email,
    school_id,
    gender,
    created_at,
    TRUE AS is_registered
FROM public.users
WHERE role = 'teacher'
UNION ALL
SELECT 
    NULL AS registered_id,
    full_name,
    email,
    school_id,
    gender,
    created_at,
    FALSE AS is_registered
FROM public.teacher_invites
WHERE NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE public.users.email = public.teacher_invites.email 
    AND public.users.role = 'teacher'
);

-- Grant access to the view
GRANT SELECT ON public.all_teachers_view TO authenticated;
GRANT SELECT ON public.all_teachers_view TO anon;
GRANT SELECT ON public.all_teachers_view TO service_role;
