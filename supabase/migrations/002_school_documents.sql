-- School documents (circulars, notices). Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS school_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'circular' CHECK (doc_type IN (
    'circular', 'notice', 'memo', 'letter', 'report', 'minutes', 'policy',
    'fee_notice', 'exam_notice', 'timetable_notice', 'sports', 'pta',
    'newsletter', 'other'
  )),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_documents_school ON school_documents(school_id);

ALTER TABLE school_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members manage documents"
  ON school_documents FOR ALL
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
  );
