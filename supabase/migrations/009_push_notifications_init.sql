-- 009_push_notifications_init.sql
-- Add support for storing push tokens for notifications

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Update RLS to allow users to update their own push token
CREATE POLICY "Users can update their own push token" 
ON public.users 
FOR UPDATE 
TO authenticated 
USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());
