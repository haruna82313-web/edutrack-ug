-- 016_add_school_type_support.sql
-- Add support for primary and secondary schools with full backward compatibility!

-- 1. Add school type to schools table - default to secondary for existing schools!
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('primary', 'secondary')) DEFAULT 'secondary';

-- 2. Update classes table level to support primary levels (P1-P7) too!
ALTER TABLE public.classes 
DROP CONSTRAINT IF EXISTS classes_level_check;
ALTER TABLE public.classes 
ADD CONSTRAINT classes_level_check CHECK (level IN ('P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'O', 'A'));

-- 3. Create a function to auto-set class level based on name and school type!
CREATE OR REPLACE FUNCTION public.set_class_level() 
RETURNS TRIGGER AS $$
BEGIN
  -- First check if school type is available
  IF NEW.name ILIKE 'P1%' OR NEW.name ILIKE 'Primary 1%' THEN
    NEW.level = 'P1';
  ELSIF NEW.name ILIKE 'P2%' OR NEW.name ILIKE 'Primary 2%' THEN
    NEW.level = 'P2';
  ELSIF NEW.name ILIKE 'P3%' OR NEW.name ILIKE 'Primary 3%' THEN
    NEW.level = 'P3';
  ELSIF NEW.name ILIKE 'P4%' OR NEW.name ILIKE 'Primary 4%' THEN
    NEW.level = 'P4';
  ELSIF NEW.name ILIKE 'P5%' OR NEW.name ILIKE 'Primary 5%' THEN
    NEW.level = 'P5';
  ELSIF NEW.name ILIKE 'P6%' OR NEW.name ILIKE 'Primary 6%' THEN
    NEW.level = 'P6';
  ELSIF NEW.name ILIKE 'P7%' OR NEW.name ILIKE 'Primary 7%' THEN
    NEW.level = 'P7';
  ELSIF NEW.name ILIKE 'S1%' OR NEW.name ILIKE 'Senior 1%' OR NEW.name ILIKE 'S2%' OR NEW.name ILIKE 'Senior 2%' OR NEW.name ILIKE 'S3%' OR NEW.name ILIKE 'Senior 3%' OR NEW.name ILIKE 'S4%' OR NEW.name ILIKE 'Senior 4%' THEN
    NEW.level = 'O';
  ELSIF NEW.name ILIKE 'S5%' OR NEW.name ILIKE 'Senior 5%' OR NEW.name ILIKE 'S6%' OR NEW.name ILIKE 'Senior 6%' THEN
    NEW.level = 'A';
  ELSE
    -- If we can't auto-detect, leave it NULL for admin to set
    NEW.level = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to auto-set class level on insert/update
DROP TRIGGER IF EXISTS trigger_set_class_level ON public.classes;
CREATE TRIGGER trigger_set_class_level
BEFORE INSERT OR UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.set_class_level();
