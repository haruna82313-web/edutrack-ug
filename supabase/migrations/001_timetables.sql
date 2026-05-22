-- Weekly timetable drafts per stream (class). Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  academic_term TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_id)
);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 4),
  period_number SMALLINT NOT NULL CHECK (period_number >= 1 AND period_number <= 12),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  room TEXT,
  UNIQUE (timetable_id, day_of_week, period_number)
);

CREATE INDEX IF NOT EXISTS idx_timetable_slots_timetable ON timetable_slots(timetable_id);

ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members manage timetables"
  ON timetables FOR ALL
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "School members manage timetable slots"
  ON timetable_slots FOR ALL
  USING (
    timetable_id IN (
      SELECT id FROM timetables WHERE school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    timetable_id IN (
      SELECT id FROM timetables WHERE school_id IN (
        SELECT school_id FROM users WHERE id = auth.uid()
      )
    )
  );
