-- 017_add_grading_configs_table.sql
-- Add configurable grading configs per school

CREATE TABLE IF NOT EXISTS public.grading_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_name TEXT NOT NULL,
  description TEXT,
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.grading_configs ENABLE ROW LEVEL SECURITY;

-- Create index for school_id
CREATE INDEX IF NOT EXISTS idx_grading_configs_school_id ON public.grading_configs(school_id);

-- Insert default primary grading config for existing secondary schools to have fallback? No, only when primary schools are created
-- Let's create a function to insert default primary grading when school type is set to primary
CREATE OR REPLACE FUNCTION public.insert_default_primary_grading()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'primary' THEN
    -- Insert default Ugandan primary grading (D1 to F9)
    INSERT INTO public.grading_configs (school_id, grade_name, description, min_score, max_score)
    VALUES
      (NEW.id, 'D1', 'EXCELLENT', 90, 100),
      (NEW.id, 'D2', 'VERY GOOD', 80, 89),
      (NEW.id, 'C3', 'GOOD', 70, 79),
      (NEW.id, 'C4', 'PROMISING STUDENT', 60, 69),
      (NEW.id, 'C5', 'NEEDS TO FOCUS', 55, 59),
      (NEW.id, 'C6', 'FAIR', 50, 54),
      (NEW.id, 'P7', 'NEEDS REVISION', 45, 49),
      (NEW.id, 'P8', 'ROOM FOR IMPROVEMENT', 40, 44),
      (NEW.id, 'F9', 'FAILED', 0, 39);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on schools table
CREATE TRIGGER trigger_insert_default_primary_grading
AFTER INSERT OR UPDATE OF type ON public.schools
FOR EACH ROW
WHEN (NEW.type = 'primary')
EXECUTE FUNCTION public.insert_default_primary_grading();

-- Create RLS policy for grading_configs
DROP POLICY IF EXISTS edutrack_grading_configs_school ON public.grading_configs;
CREATE POLICY edutrack_grading_configs_school ON public.grading_configs
  FOR ALL TO authenticated
  USING (school_id = public.auth_user_school_id())
  WITH CHECK (school_id = public.auth_user_school_id());

-- Grant permissions on grading_configs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grading_configs TO authenticated;
