import { supabase } from './supabase';

export const RLS_SETUP_HINT =
  'Run supabase/migrations/004_admin_crud_policies.sql in your Supabase SQL Editor, then try again.';

function formatDeleteError(table, error) {
  if (!error) return `Delete failed on ${table}.`;
  if (error.code === '42501' || /policy|permission|denied/i.test(error.message || '')) {
    return `Delete blocked on ${table} (database permissions). ${RLS_SETUP_HINT}`;
  }
  return error.message || `Delete failed on ${table}.`;
}

/** Delete rows and confirm at least one was removed. */
export async function deleteRows(table, filter) {
  let query = supabase.from(table).delete();

  Object.entries(filter).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else {
      query = query.eq(key, value);
    }
  });

  const { data, error } = await query.select('id');

  if (error) throw new Error(formatDeleteError(table, error));
  if (!data?.length) {
    throw new Error(
      `Nothing was deleted from ${table}. ${RLS_SETUP_HINT}`
    );
  }
  return data;
}

/** Delete related rows (no throw if zero rows). */
async function deleteRelated(table, filter) {
  let query = supabase.from(table).delete();

  Object.entries(filter).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else {
      query = query.eq(key, value);
    }
  });

  const { error } = await query;
  if (error) throw new Error(formatDeleteError(table, error));
}

async function safeTimetableCleanup(classId) {
  try {
    const { data: timetables } = await supabase
      .from('timetables')
      .select('id')
      .eq('class_id', classId);

    if (timetables?.length) {
      const ttIds = timetables.map((t) => t.id);
      await deleteRelated('timetable_slots', { timetable_id: ttIds });
      await deleteRelated('timetables', { id: ttIds });
    }
  } catch {
    /* timetables tables may not exist yet */
  }
}

export async function deleteStudentCascade(studentId) {
  await deleteRelated('attendance', { student_id: studentId });
  await deleteRows('students', { id: studentId });
}

export async function deleteClassCascade(classId) {
  const { data: students } = await supabase.from('students').select('id').eq('class_id', classId);
  if (students?.length) {
    throw new Error(
      `Cannot delete class: ${students.length} student(s) still assigned. Move or delete them first.`
    );
  }
  await deleteRelated('syllabus_topics', { class_id: classId });

  const { data: lessons } = await supabase.from('lessons').select('id').eq('class_id', classId);
  if (lessons?.length) {
    const lessonIds = lessons.map((l) => l.id);
    await deleteRelated('attendance', { lesson_id: lessonIds });
    await deleteRelated('lessons', { id: lessonIds });
  }

  await safeTimetableCleanup(classId);
  await deleteRows('classes', { id: classId });
}

export async function deleteSubjectCascade(subjectId) {
  await deleteRelated('syllabus_topics', { subject_id: subjectId });

  const { data: lessons } = await supabase.from('lessons').select('id').eq('subject_id', subjectId);
  if (lessons?.length) {
    const lessonIds = lessons.map((l) => l.id);
    await deleteRelated('attendance', { lesson_id: lessonIds });
    await deleteRelated('lessons', { id: lessonIds });
  }

  await deleteRows('subjects', { id: subjectId });
}

export async function deleteLessonCascade(lessonId) {
  await deleteRelated('attendance', { lesson_id: lessonId });
  await deleteRows('lessons', { id: lessonId });
}

export async function deleteSyllabusTopic(topicId) {
  await deleteRows('syllabus_topics', { id: topicId });
}

export async function deleteTeacherInvite(email, schoolId) {
  let query = supabase.from('teacher_invites').delete().eq('email', email);
  if (schoolId) query = query.eq('school_id', schoolId);
  const { data, error } = await query.select('email');
  if (error) throw new Error(formatDeleteError('teacher_invites', error));
  if (!data?.length) {
    throw new Error(`Could not revoke invite. ${RLS_SETUP_HINT}`);
  }
}

export async function deleteSchoolDocument(documentId) {
  await deleteRows('school_documents', { id: documentId });
}
