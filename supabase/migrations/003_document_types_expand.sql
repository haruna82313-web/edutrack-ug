-- Run if you already created school_documents with the old 4-type constraint.

ALTER TABLE school_documents DROP CONSTRAINT IF EXISTS school_documents_doc_type_check;

ALTER TABLE school_documents ADD CONSTRAINT school_documents_doc_type_check
  CHECK (doc_type IN (
    'circular', 'notice', 'memo', 'letter', 'report', 'minutes', 'policy',
    'fee_notice', 'exam_notice', 'timetable_notice', 'sports', 'pta',
    'newsletter', 'other'
  ));
