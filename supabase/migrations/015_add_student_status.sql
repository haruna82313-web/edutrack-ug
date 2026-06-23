-- Add student status fields for soft delete and archiving
-- Supports: active, inactive, graduated, transferred, suspended

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred', 'suspended')),
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- Ensure existing students have active status
UPDATE public.students SET status = 'active' WHERE status IS NULL;
