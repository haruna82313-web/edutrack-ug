-- 007_add_subscription_to_schools.sql
-- Add subscription_status column to schools table

ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'Inactive';

-- Update all existing schools to 'Active' so they aren't locked out immediately
UPDATE public.schools SET subscription_status = 'Active' WHERE subscription_status IS NULL;
