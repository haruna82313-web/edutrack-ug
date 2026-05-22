import { supabase } from './supabase';

export async function fetchDataset(datasetId) {
  const today = new Date().toISOString().split('T')[0];

  switch (datasetId) {
    case 'students': {
      const { data, error } = await supabase
        .from('students')
        .select('full_name, parent_phone, classes(name), created_at')
        .order('full_name');
      if (error) throw error;
      return {
        title: 'Student Directory',
        headers: ['Name', 'Class', 'Parent phone', 'Enrolled'],
        rows: (data || []).map((r) => [
          r.full_name,
          r.classes?.name || '—',
          r.parent_phone || '—',
          r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
        ]),
      };
    }
    case 'teachers': {
      const { data, error } = await supabase.from('all_teachers_view').select('*').order('full_name');
      if (error) throw error;
      return {
        title: 'Staff Directory',
        headers: ['Name', 'Email', 'Status'],
        rows: (data || []).map((r) => [
          r.full_name,
          r.email,
          r.is_registered ? 'Active' : 'Pending',
        ]),
      };
    }
    case 'classes': {
      const { data, error } = await supabase.from('classes').select('name, created_at').order('name');
      if (error) throw error;
      return {
        title: 'Class Registry',
        headers: ['Class', 'Created'],
        rows: (data || []).map((r) => [r.name, new Date(r.created_at).toLocaleDateString()]),
      };
    }
    case 'subjects': {
      const { data, error } = await supabase.from('subjects').select('name').order('name');
      if (error) throw error;
      return {
        title: 'Subjects',
        headers: ['Subject'],
        rows: (data || []).map((r) => [r.name]),
      };
    }
    case 'lessons': {
      const { data, error } = await supabase
        .from('lessons')
        .select('lesson_date, start_time, end_time, status, subjects(name), classes(name), users(full_name)')
        .order('lesson_date', { ascending: false });
      if (error) throw error;
      return {
        title: 'Lessons',
        headers: ['Date', 'Time', 'Subject', 'Class', 'Teacher', 'Status'],
        rows: (data || []).map((r) => [
          r.lesson_date,
          r.start_time || '—',
          r.subjects?.name || '—',
          r.classes?.name || '—',
          r.users?.full_name || '—',
          r.status || '—',
        ]),
      };
    }
    case 'attendance': {
      const { data, error } = await supabase
        .from('attendance')
        .select('status, created_at, students(full_name, parent_phone, classes(name))')
        .eq('status', 'absent')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);
      if (error) throw error;
      return {
        title: `Absentees — ${today}`,
        headers: ['Student', 'Class', 'Parent phone', 'Recorded'],
        rows: (data || []).map((r) => [
          r.students?.full_name || '—',
          r.students?.classes?.name || '—',
          r.students?.parent_phone || '—',
          r.created_at ? new Date(r.created_at).toLocaleString() : '—',
        ]),
      };
    }
    case 'syllabus': {
      const { data, error } = await supabase
        .from('syllabus_topics')
        .select('term, topic_title, competency_description, status, subjects(name), classes(name)')
        .order('order_index');
      if (error) throw error;
      return {
        title: 'Syllabus',
        headers: ['Class', 'Subject', 'Term', 'Topic', 'Status'],
        rows: (data || []).map((r) => [
          r.classes?.name || '—',
          r.subjects?.name || '—',
          `Term ${r.term}`,
          r.topic_title,
          r.status || '—',
        ]),
      };
    }
    default:
      throw new Error('Unknown dataset');
  }
}
