export const DOC_TYPES = [
  { value: 'circular', label: 'Circular' },
  { value: 'notice', label: 'General notice' },
  { value: 'memo', label: 'Internal memo' },
  { value: 'letter', label: 'Official letter' },
  { value: 'report', label: 'Report' },
  { value: 'minutes', label: 'Meeting minutes' },
  { value: 'policy', label: 'School policy' },
  { value: 'fee_notice', label: 'Fees / payment notice' },
  { value: 'exam_notice', label: 'Examination notice' },
  { value: 'timetable_notice', label: 'Timetable / schedule notice' },
  { value: 'sports', label: 'Sports / co-curricular' },
  { value: 'pta', label: 'PTA / parents notice' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'other', label: 'Other document' },
];

export const DOC_TYPE_VALUES = DOC_TYPES.map((d) => d.value);

export const docTypeLabel = (value) =>
  DOC_TYPES.find((d) => d.value === value)?.label || value;
