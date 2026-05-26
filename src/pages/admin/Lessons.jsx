import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, AlertCircle, Loader2, User, BookOpen, GraduationCap, Plus, ArrowRight, Zap, Search } from 'lucide-react';
import EditModal from '../../components/admin/EditModal';
import RowActions from '../../components/admin/RowActions';
import { deleteLessonCascade } from '../../lib/adminCrud';

const Lessons = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [filterRange, setFilterRange] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [customDate, setCustomDate] = useState('');

  const [formData, setFormData] = useState({
    teacherEmail: '', subjectId: '', classId: '', startTime: '', endTime: ''
  });

  useEffect(() => {
    fetchData(filterRange);
  }, []);

  const filteredLessons = lessons.filter(lesson => {
    const query = searchQuery.toLowerCase();
    return (
      lesson.subjects?.name?.toLowerCase().includes(query) ||
      lesson.classes?.name?.toLowerCase().includes(query) ||
      lesson.users?.full_name?.toLowerCase().includes(query) ||
      lesson.lesson_date?.includes(query)
    );
  });

  const fetchData = async (range = filterRange, date = customDate) => {
    try {
      setLoading(true);
      setError(null);
      setFilterRange(range);
      if (date) setCustomDate(date);

      const { data: profile, error: profileError } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      if (profileError) throw profileError;
      
      const sid = profile?.school_id;
      if (!sid) throw new Error("School ID not found for current user.");

      const [tRes, sRes, cRes] = await Promise.all([
        supabase.from('all_teachers_view').select('*').eq('school_id', sid),
        supabase.from('subjects').select('*').eq('school_id', sid).order('name'),
        supabase.from('classes').select('*').eq('school_id', sid).order('name')
      ]);

      console.log("Teachers from view:", tRes.data);

      if (tRes.error) {
        console.error("Error fetching teachers:", tRes.error);
        const { data: userData } = await supabase.from('users')
          .select('id, full_name, email, gender, school_id')
          .eq('role', 'teacher')
          .eq('school_id', sid);
        setTeachers(userData?.map(u => ({ ...u, registered_id: u.id, is_registered: true })) || []);
      } else {
        setTeachers(tRes.data || []);
      }
      
      setSubjects(sRes.data || []);
      setClasses(cRes.data || []);

      let lQuery = supabase
        .from('lessons')
        .select('*, subjects(name), classes(name), users(full_name)')
        .order('lesson_date', { ascending: false });
      
      if (sid) {
        lQuery = lQuery.eq('school_id', sid);
      }

      if (range === 'custom' && date) {
        lQuery = lQuery.eq('lesson_date', date);
      } else {
        const now = new Date();
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        if (range === 'yesterday') {
          startDate.setDate(startDate.getDate() - 1);
        } else if (range === 'week') {
          startDate.setDate(startDate.getDate() - 7);
        } else if (range === 'month') {
          startDate.setMonth(startDate.getMonth() - 1);
        } else if (range === '3months') {
          startDate.setMonth(startDate.getMonth() - 3);
        }

        if (range === 'today') {
          lQuery = lQuery.gte('lesson_date', startDate.toISOString().split('T')[0]);
        } else if (range === 'yesterday') {
          const yesterdayStr = startDate.toISOString().split('T')[0];
          lQuery = lQuery.eq('lesson_date', yesterdayStr);
        } else {
          lQuery = lQuery.gte('lesson_date', startDate.toISOString().split('T')[0]);
        }
      }

      const { data: lData, error: lError } = await lQuery;
      
      if (lError) throw lError;
      setLessons(lData || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    setScheduling(true);
    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      const selectedTeacher = teachers.find(t => t.email === formData.teacherEmail);

      const { error: insError } = await supabase.from('lessons').insert([{
        school_id: profile.school_id,
        teacher_id: selectedTeacher?.registered_id || null,
        subject_id: formData.subjectId,
        class_id: formData.classId,
        start_time: formData.startTime,
        end_time: formData.endTime || formData.startTime,
        lesson_date: new Date().toISOString().split('T')[0]
      }]);

      if (insError) throw insError;

      setFormData({ teacherEmail: '', subjectId: '', classId: '', startTime: '', endTime: '' });
      fetchData(filterRange);
    } catch (err) {
      alert("Scheduling error: " + err.message);
    } finally {
      setScheduling(false);
    }
  };

  const deleteLesson = async (id) => {
    if (!confirm('Delete this lesson and its attendance records?')) return;
    try {
      await deleteLessonCascade(id);
      fetchData(filterRange);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const { error: updError } = await supabase
        .from('lessons')
        .update({
          teacher_id: editing.teacherId || null,
          subject_id: editing.subjectId,
          class_id: editing.classId,
          start_time: editing.startTime,
          end_time: editing.endTime || editing.startTime,
          lesson_date: editing.lessonDate,
        })
        .eq('id', editing.id);
      if (updError) throw updError;
      setEditing(null);
      fetchData(filterRange);
    } catch (err) {
      alert('Update failed: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const ranges = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'Last Month' },
    { id: '3months', label: '3 Months' },
  ];

  const openEditLesson = (lesson) => {
    setEditing({
      id: lesson.id,
      teacherId: lesson.teacher_id || '',
      subjectId: lesson.subject_id,
      classId: lesson.class_id,
      startTime: lesson.start_time || '',
      endTime: lesson.end_time || '',
      lessonDate: lesson.lesson_date,
    });
  };

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 text-white">
      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search lessons by subject, class, or teacher..."
            className="input-field pl-12 h-14"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-aurora-cyan" size={20} />
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto no-scrollbar max-w-full">
          {ranges.map((range) => (
            <button
              key={range.id}
              onClick={() => {
                setCustomDate('');
                fetchData(range.id, '');
              }}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filterRange === range.id && !customDate
                  ? 'bg-aurora-cyan text-aurora-navy shadow-neon-cyan' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {range.label}
            </button>
          ))}
          <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
          <div className="relative flex items-center">
            <input
              type="date"
              className={`bg-transparent border-none text-[9px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer ${customDate ? 'text-aurora-cyan' : 'text-slate-500'}`}
              value={customDate}
              onChange={(e) => {
                const date = e.target.value;
                setCustomDate(date);
                if (date) fetchData('custom', date);
              }}
            />
            {customDate && (
              <button 
                onClick={() => {
                  setCustomDate('');
                  fetchData('today', '');
                }}
                className="ml-1 text-slate-500 hover:text-white"
              >
                <ArrowRight className="rotate-180" size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-aurora-rose/10 border border-aurora-rose/20 text-aurora-rose px-6 py-4 rounded-2xl flex items-center gap-3 animate-in shake duration-500 shadow-neon-rose">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      {/* Schedule Form */}
      <div className="glass-card p-6 lg:p-10">
        <h3 className="font-black text-white mb-8 flex items-center gap-3 text-xs uppercase tracking-[0.3em]">
          <Plus size={20} className="text-aurora-cyan" /> New Instructional Session
        </h3>
        
        <form onSubmit={handleAddLesson} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Instructor</label>
            <div className="relative">
              <select
                className="input-field pl-12 appearance-none"
                value={formData.teacherEmail}
                onChange={(e) => setFormData({...formData, teacherEmail: e.target.value})}
                required
              >
                <option value="">Select Staff</option>
                {teachers.map(t => (
                  <option key={t.email} value={t.email}>
                    {t.full_name} {t.is_registered ? '' : '(Invited)'} ({t.gender === 'Male' ? 'M' : 'F'})
                  </option>
                ))}
              </select>
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-aurora-cyan" size={18} />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Academic Subject</label>
            <div className="relative">
              <select
                className="input-field pl-12 appearance-none"
                value={formData.subjectId}
                onChange={(e) => setFormData({...formData, subjectId: e.target.value})}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-aurora-violet" size={18} />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Class</label>
            <div className="relative">
              <select
                className="input-field pl-12 appearance-none"
                value={formData.classId}
                onChange={(e) => setFormData({...formData, classId: e.target.value})}
                required
              >
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-aurora-amber" size={18} />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Session Start</label>
            <div className="relative">
              <input
                type="time"
                className="input-field pl-12"
                value={formData.startTime}
                onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                required
              />
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-aurora-emerald" size={18} />
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-2 pt-6">
            <button
              type="submit"
              disabled={scheduling}
              className="btn-primary w-full py-5 text-[11px] font-black uppercase tracking-[0.3em] group shadow-neon-cyan"
            >
              {scheduling ? <Loader2 className="animate-spin" size={20} /> : <><Zap size={18} /> Synchronize Session <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" /></>}
            </button>
          </div>
        </form>
      </div>

      {/* Lesson Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="glass-card p-12 text-center border-dashed">
            <Loader2 className="animate-spin text-aurora-cyan mx-auto mb-4" size={32} />
            <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Processing Node Data...</p>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="glass-card p-16 text-center border-dashed">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-700 mb-6">
              <Calendar size={40} />
            </div>
            <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No matching sessions found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLessons.map((lesson) => (
              <div key={lesson.id} className="bg-slate-900 p-5 rounded-3xl shadow-xl border border-slate-800 hover:border-aurora-cyan/30 transition-all group relative overflow-hidden active:scale-[0.98]">
                <div className="absolute top-0 right-0 w-16 h-16 bg-aurora-cyan/5 rounded-bl-[2.5rem]"></div>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="inline-block text-[8px] font-black uppercase tracking-widest text-aurora-cyan bg-aurora-cyan/10 px-2 py-0.5 rounded-full border border-aurora-cyan/20 break-words max-w-full">
                      {lesson.subjects?.name}
                    </span>
                    <h3 className="text-lg font-black text-white tracking-tight mt-2 break-words leading-tight" title={lesson.classes?.name}>{lesson.classes?.name}</h3>
                    <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1.5 mt-1">
                      <User size={12} className="text-aurora-violet shrink-0" /> {lesson.users?.full_name || 'TBD'}
                    </p>
                  </div>
                  <RowActions
                    onEdit={() => openEditLesson(lesson)}
                    onDelete={() => deleteLesson(lesson.id)}
                  />
                </div>

                <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/50 relative z-10">
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                    <Clock size={12} className="text-aurora-cyan shrink-0" /> {lesson.start_time?.substring(0, 5)} - {lesson.end_time?.substring(0, 5)}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[9px] uppercase tracking-widest">
                    <Calendar size={12} className="shrink-0" /> {lesson.lesson_date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditModal open={!!editing} title="Edit lesson" onClose={() => setEditing(null)} onSave={saveEdit} saving={savingEdit}>
        <input type="date" className="input-field w-full" value={editing?.lessonDate || ''} onChange={(e) => setEditing({ ...editing, lessonDate: e.target.value })} />
        <select className="input-field w-full appearance-none" value={editing?.teacherId || ''} onChange={(e) => setEditing({ ...editing, teacherId: e.target.value })}>
          <option value="">Unassigned</option>
          {teachers.map((t) => (
            <option key={t.email} value={t.registered_id || ''} disabled={!t.is_registered}>
              {t.full_name} {!t.is_registered ? '(Invited - Pending Registration)' : `(${t.gender === 'Male' ? 'M' : 'F'})`}
            </option>
          ))}
        </select>
        <select className="input-field w-full appearance-none" value={editing?.subjectId || ''} onChange={(e) => setEditing({ ...editing, subjectId: e.target.value })}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input-field w-full appearance-none" value={editing?.classId || ''} onChange={(e) => setEditing({ ...editing, classId: e.target.value })}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="time" className="input-field w-full" value={editing?.startTime || ''} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} />
        <input type="time" className="input-field w-full" value={editing?.endTime || ''} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} />
      </EditModal>
    </div>
  );
};

export default Lessons;
