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
    -- Insert default Ugandan primary grading (example)
    INSERT INTO public.grading_configs (school_id, grade_name, description, min_score, max_score)
    VALUES
      (NEW.id, 'A', 'Excellent', 80, 100),
      (NEW.id, 'B', 'Very Good', 70, 79),
      (NEW.id, 'C', 'Good', 60, 69),
      (NEW.id, 'D', 'Fair', 50, 59),
      (NEW.id, 'E', 'Needs Improvement', 0, 49);
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
