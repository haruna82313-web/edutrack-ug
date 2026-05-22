import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus, queueOfflineAction, useOfflineSync } from '../../lib/offline';
import { 
  LogOut, BookOpen, Clock, Star, Target, 
  CheckCircle2, XCircle, ChevronLeft, ListChecks,
  Calendar, GraduationCap, Zap, User, ArrowRight,
  ClipboardList, Loader2, WifiOff, CloudUpload, ShieldCheck
} from 'lucide-react';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState('schedule'); 
  const [lessons, setLessons] = useState([]);
  const [syllabusTopics, setSyllabusTopics] = useState([]);
  const [activeLesson, setActiveLesson] = useState(null);
  const [students, setStudents] = useState([]);
  const [absentees, setAbsentees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('Active');
  
  // Marks state
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [marks, setMarks] = useState({}); // { studentId: score }
  const [submittingMarks, setSubmittingMarks] = useState(false);

  useEffect(() => {
    let subChannel;
    const checkSubscription = async () => {
      try {
        const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).maybeSingle();
        if (profile?.school_id) {
          const { data: schools } = await supabase.from('schools').select('subscription_status').eq('id', profile.school_id);
          
          if (!schools || schools.length === 0) {
            setSubscriptionStatus('Active');
            return;
          }

          const school = schools[0];
           setSubscriptionStatus(school.subscription_status || 'Inactive');

          if (subChannel) supabase.removeChannel(subChannel);
          subChannel = supabase
            .channel(`teacher-status-${profile.school_id}-${Math.random().toString(36).substring(7)}`)
            .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'schools',
              filter: `id=eq.${profile.school_id}`
            }, (payload) => {
              if (payload.new.subscription_status) {
                setSubscriptionStatus(payload.new.subscription_status);
              }
            })
            .subscribe();
        }
      } catch (err) {
        console.error(err);
        setSubscriptionStatus('Active');
      }
    };
    checkSubscription();
    return () => { if (subChannel) supabase.removeChannel(subChannel); };
  }, [user.id]);

  // Define sync logic for offline data
  const handleSync = useCallback(async (queue) => {
    setSyncing(true);
    let allSuccess = true;

    for (const action of queue) {
      if (action.type === 'MARK_ATTENDANCE') {
        const { error } = await supabase.from('attendance').insert(action.payload.records);
        if (error) {
          allSuccess = false;
        } else {
          await supabase.from('lessons').update({ status: 'completed' }).eq('id', action.payload.lessonId);
        }
      } else if (action.type === 'SUBMIT_MARKS') {
        const { error } = await supabase.from('student_marks').insert(action.payload.records);
        if (error) allSuccess = false;
      }
    }

    setSyncing(false);
    if (allSuccess) fetchTeacherData();
    return allSuccess;
  }, [user.id]);

  const { queueLength } = useOfflineSync(handleSync);

  useEffect(() => {
    if (isOnline) {
      fetchTeacherData();
      fetchGradesData();
    }
  }, [user.id, isOnline]);

  const fetchTeacherData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const [lessonRes, topicRes] = await Promise.all([
        supabase.from('lessons').select('*, subjects(name), classes(name)').eq('teacher_id', user.id).eq('lesson_date', today).order('start_time'),
        supabase.from('syllabus_topics').select('*, subjects(name), classes(name)').order('order_index')
      ]);

      setLessons(lessonRes.data || []);
      setSyllabusTopics(topicRes.data || []);
    } catch (err) {
      console.error('Offline or error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGradesData = async () => {
    try {
      const [classRes, subjectRes] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name')
      ]);
      setClasses(classRes.data || []);
      setSubjects(subjectRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudentsForMarks = async (classId) => {
    if (!classId) return;
    setLoading(true);
    const { data } = await supabase.from('students').select('*').eq('class_id', classId).order('full_name');
    setStudents(data || []);
    setMarks({});
    setLoading(false);
  };

  const submitMarks = async () => {
    if (!selectedClass || !selectedSubject) return;
    setSubmittingMarks(true);

    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      
      const records = Object.entries(marks).map(([studentId, score]) => ({
        student_id: studentId,
        subject_id: selectedSubject,
        teacher_id: user.id,
        marks: parseFloat(score),
        max_marks: 100,
        school_id: profile.school_id,
        year: 2026,
        term: 'Term 1' // Default term
      }));

      if (records.length === 0) return;

      if (!isOnline) {
        queueOfflineAction('SUBMIT_MARKS', { records });
        alert("Working Offline: Marks saved locally and will sync later.");
      } else {
        const { error } = await supabase.from('student_marks').insert(records);
        if (error) throw error;
        alert("Success: Marks submitted successfully!");
      }
      
      setMarks({});
      setSelectedClass('');
      setSelectedSubject('');
      setStudents([]);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingMarks(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const openAttendance = async (lesson) => {
    setActiveLesson(lesson);
    setLoading(true);
    const { data } = await supabase.from('students').select('*').eq('class_id', lesson.class_id).order('full_name');
    setStudents(data || []);
    setAbsentees([]); 
    setLoading(false);
  };

  const submitAttendance = async () => {
    setLoading(true);
    const records = students.map(s => ({
      school_id: activeLesson.school_id,
      lesson_id: activeLesson.id,
      student_id: s.id,
      status: absentees.includes(s.id) ? 'absent' : 'present'
    }));

    if (!isOnline) {
      queueOfflineAction('MARK_ATTENDANCE', { records, lessonId: activeLesson.id });
      setActiveLesson(null);
      setLoading(false);
      alert("Working Offline: Your attendance record has been saved locally and will sync when internet returns.");
      return;
    }

    const { error } = await supabase.from('attendance').insert(records);
    if (!error) {
      await supabase.from('lessons').update({ status: 'completed' }).eq('id', activeLesson.id);
      setActiveLesson(null);
      fetchTeacherData();
    }
    setLoading(false);
  };

  const markTopicComplete = async (topicId) => {
    const { error } = await supabase.from('syllabus_topics').update({ status: 'completed', completed_at: new Date() }).eq('id', topicId);
    if (!error) { fetchTeacherData(); }
  };

  const isSubscribed = subscriptionStatus?.toLowerCase() === 'active';

  if (activeLesson) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans p-4 lg:p-8 animate-in slide-in-from-right duration-500 text-slate-300">
        <div className="max-w-3xl mx-auto">
          <button 
            onClick={() => setActiveLesson(null)} 
            className="flex items-center gap-2 text-primary-400 font-black text-[10px] lg:text-xs uppercase tracking-widest mb-6 lg:mb-8 hover:gap-3 transition-all"
          >
            <ChevronLeft size={16} /> Back to Hub
          </button>
          
          <div className="bg-slate-900 rounded-3xl lg:rounded-[2.5rem] p-6 lg:p-8 shadow-2xl border border-slate-800 mb-6 lg:mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/10 rounded-bl-full pointer-events-none"></div>
            <div className="flex items-center gap-4 mb-5 relative z-10">
              <div className="w-12 h-12 lg:w-14 lg:h-14 bg-primary-600/10 text-primary-400 rounded-2xl flex items-center justify-center shrink-0 border border-primary-500/20 shadow-glow">
                <ClipboardList size={24} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight truncate">{activeLesson.classes?.name}</h2>
                <p className="text-slate-500 font-bold text-[10px] lg:text-sm uppercase tracking-widest truncate">{activeLesson.subjects?.name}</p>
              </div>
            </div>
            
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 lg:p-4 rounded-2xl flex items-center gap-3 relative z-10 shadow-rose-glow">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0"></div>
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-tight">Mark students who are ABSENT</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-32">
            {students.map(s => (
              <button 
                key={s.id} 
                onClick={() => setAbsentees(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                className={`p-4 lg:p-6 rounded-3xl border-2 flex justify-between items-center transition-all duration-300 text-left group active:scale-[0.98] ${
                  absentees.includes(s.id) 
                    ? 'border-rose-500 bg-rose-500/10 shadow-rose-glow' 
                    : 'border-slate-800 bg-slate-900 hover:border-primary-500/30'
                }`}
              >
                <div className="min-w-0">
                  <span className={`block font-black tracking-tight text-sm lg:text-base truncate ${absentees.includes(s.id) ? 'text-rose-400' : 'text-slate-100'}`}>
                    {s.full_name}
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    {absentees.includes(s.id) ? 'Absent' : 'Present'}
                  </span>
                </div>
                <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 ${
                  absentees.includes(s.id) ? 'bg-rose-500 text-white shadow-rose-glow' : 'bg-emerald-500 text-white shadow-emerald-glow'
                }`}>
                  {absentees.includes(s.id) ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                </div>
              </button>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 lg:p-6 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 flex justify-center z-30">
            <button 
              onClick={submitAttendance} 
              disabled={loading}
              className="w-full max-w-xl bg-primary-600 text-white py-4 lg:py-5 rounded-2xl lg:rounded-[2rem] font-black text-xs lg:text-sm uppercase tracking-[0.2em] shadow-glow hover:bg-primary-500 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Finalize Record <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans pb-32 text-slate-100 relative">
      {!isSubscribed && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
          <div className="bg-slate-900 border border-rose-500/50 p-8 lg:p-12 rounded-[2.5rem] shadow-neon-rose max-w-sm lg:max-w-md animate-in zoom-in duration-500">
            <ShieldCheck className="text-rose-500 mx-auto mb-6" size={48} lg:size={64} />
            <h3 className="text-xl lg:text-2xl font-black text-white uppercase tracking-tighter mb-4">Node Deactivated</h3>
            <p className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed mb-6">
              Access to the staff instructional matrix is currently restricted due to an inactive institutional subscription.
            </p>
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Manual Activation</p>
              <p className="text-xs font-black text-white uppercase tracking-widest leading-relaxed">
                Contact your school administrator to renew the terminal access.
              </p>
            </div>
          </div>
        </div>
      )}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 lg:px-12 py-4 lg:py-5 flex justify-between items-center sticky top-0 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 lg:w-10 lg:h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-glow shrink-0">
            <GraduationCap className="text-white" size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-black text-white tracking-tight leading-none truncate">EduTrack</h1>
            <div className="flex items-center gap-2 mt-1">
              {isOnline ? (
                <div className="text-[9px] lg:text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Online
                </div>
              ) : (
                <div className="text-[9px] lg:text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                  <WifiOff size={10} /> Offline Mode
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {queueLength > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-primary-600/10 text-primary-400 px-3 py-1.5 rounded-full border border-primary-500/20 text-[9px] font-black uppercase tracking-widest animate-pulse">
              <CloudUpload size={12} /> {queueLength} Pending Sync
            </div>
          )}
          <button onClick={handleLogout} className="p-2.5 lg:p-3 bg-slate-800 text-slate-400 rounded-xl lg:rounded-2xl hover:bg-rose-500/10 hover:text-rose-400 transition-all shrink-0">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 lg:p-12 space-y-8 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
        {syncing && (
          <div className="bg-primary-600 text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-3 shadow-glow animate-bounce">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-xs font-black uppercase tracking-widest">Synchronizing local data...</span>
          </div>
        )}

        {/* Welcome Card */}
        <div className="bg-slate-900 rounded-3xl lg:rounded-[2.5rem] p-6 lg:p-12 text-white relative overflow-hidden shadow-2xl border border-slate-800">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary-600/10 to-transparent"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 text-[9px] lg:text-[10px] font-black uppercase tracking-widest mb-1 lg:mb-2 shadow-emerald-glow">
                <Zap size={12} /> Active Session
              </div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight leading-none text-white">Hello, Staff Member</h2>
              <p className="text-slate-400 font-medium tracking-tight text-sm lg:text-base">Your instructional path for today is ready.</p>
            </div>
            <div className="flex items-center gap-4 bg-slate-950/40 backdrop-blur-md border border-slate-800 p-4 rounded-2xl lg:rounded-3xl self-start">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary-600 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 shadow-glow">
                <Calendar className="text-white" size={20} lg:size={24} />
              </div>
              <div>
                <p className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Cycle</p>
                <p className="text-xs lg:text-sm font-bold whitespace-nowrap text-slate-100">{new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1.5 lg:p-2 rounded-2xl lg:rounded-[2rem] shadow-xl border border-slate-800">
          <button 
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl lg:rounded-[1.5rem] font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all ${activeTab === 'schedule' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Clock size={14} lg:size={16} /> Daily Hub
          </button>
          <button 
            onClick={() => setActiveTab('grades')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl lg:rounded-[1.5rem] font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all ${activeTab === 'grades' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Target size={14} lg:size={16} /> Academic Grades
          </button>
          <button 
            onClick={() => setActiveTab('syllabus')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl lg:rounded-[1.5rem] font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all ${activeTab === 'syllabus' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <ListChecks size={14} lg:size={16} /> Syllabus Map
          </button>
        </div>

        {/* Dynamic Content */}
        <div className="space-y-6">
          {activeTab === 'schedule' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              {lessons.length === 0 ? (
                <div className="col-span-full py-16 lg:py-20 text-center space-y-4 bg-slate-900 rounded-3xl lg:rounded-[2.5rem] border border-dashed border-slate-800">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-700">
                    <Calendar size={24} lg:size={32} />
                  </div>
                  <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">No active sessions for today</p>
                </div>
              ) : (
                lessons.map(lesson => (
                  <div key={lesson.id} className="bg-slate-900 p-6 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-xl border border-slate-800 hover:shadow-primary-500/10 transition-all duration-300 group relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-20 h-20 lg:w-24 lg:h-24 rounded-bl-[3rem] lg:rounded-bl-[4rem] transition-colors ${lesson.status === 'completed' ? 'bg-emerald-500/5' : 'bg-primary-500/5'}`}></div>
                    
                    <div className="flex justify-between items-start mb-5 lg:mb-6 relative z-10">
                      <div className="space-y-1 min-w-0">
                        <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${lesson.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-primary-500/10 text-primary-400 border-primary-500/20'}`}>
                          {lesson.status === 'completed' ? 'Synchronized' : 'Awaiting Entry'}
                        </span>
                        <h3 className="text-xl lg:text-2xl font-black text-white tracking-tight mt-3 break-words" title={lesson.classes?.name}>{lesson.classes?.name}</h3>
                        <p className="text-slate-500 font-bold text-xs lg:text-sm uppercase tracking-widest break-words" title={lesson.subjects?.name}>{lesson.subjects?.name}</p>
                      </div>
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-slate-800 rounded-xl lg:rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-primary-600 group-hover:text-white transition-all shrink-0 group-hover:shadow-glow">
                        <Clock size={18} lg:size={20} />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 lg:mt-8 relative z-10">
                      <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] lg:text-xs uppercase tracking-widest">
                        <Target size={14} className="text-primary-400 shrink-0" /> Room {lesson.room_id || 'TBD'}
                      </div>
                      {lesson.status !== 'completed' && (
                        <button 
                          onClick={() => openAttendance(lesson)}
                          className="bg-primary-600 text-white px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] uppercase tracking-[0.2em] hover:bg-primary-500 transition-all flex items-center justify-center gap-2 shadow-glow"
                        >
                          Mark Presence <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'grades' ? (
            <div className="space-y-6">
              <div className="bg-slate-900 p-6 lg:p-8 rounded-3xl border border-slate-800 shadow-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Class</label>
                    <select 
                      className="input-field appearance-none"
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        fetchStudentsForMarks(e.target.value);
                      }}
                    >
                      <option value="">Choose Class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Subject</label>
                    <select 
                      className="input-field appearance-none"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                    >
                      <option value="">Choose Subject</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {students.length > 0 && (
                <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/30">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Marks Entry Matrix</h3>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {students.map(s => (
                      <div key={s.id} className="p-4 lg:p-6 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center font-black text-xs">
                            {s.full_name.substring(0, 1).toUpperCase()}
                          </div>
                          <span className="font-black text-slate-200 text-sm lg:text-base">{s.full_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number"
                            placeholder="0"
                            min="0"
                            max="100"
                            className="w-20 lg:w-24 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-center font-black text-primary-400 focus:border-primary-500 outline-none transition-all"
                            value={marks[s.id] || ''}
                            onChange={(e) => setMarks(prev => ({ ...prev, [s.id]: e.target.value }))}
                          />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">/ 100</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-6 bg-slate-950/30 flex justify-end">
                    <button 
                      onClick={submitMarks}
                      disabled={submittingMarks || !selectedSubject}
                      className="btn-primary px-10 py-4 text-xs shadow-glow disabled:opacity-50"
                    >
                      {submittingMarks ? <Loader2 className="animate-spin" size={18} /> : <>Submit Results <ArrowRight size={16} /></>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 lg:space-y-4">
              {syllabusTopics.map(topic => (
                <div key={topic.id} className="bg-slate-900 p-4 lg:p-6 rounded-2xl lg:rounded-3xl shadow-xl border border-slate-800 flex items-center justify-between hover:shadow-primary-500/5 transition-all group active:scale-[0.99]">
                  <div className="flex items-center gap-4 lg:gap-5 min-w-0">
                    <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 transition-colors ${topic.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 group-hover:bg-primary-600/10 group-hover:text-primary-400 group-hover:border group-hover:border-primary-500/20'}`}>
                      {topic.status === 'completed' ? <CheckCircle2 size={20} lg:size={24} /> : <BookOpen size={20} lg:size={24} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-black tracking-tight text-sm lg:text-base break-words ${topic.status === 'completed' ? 'text-slate-500 line-through opacity-60' : 'text-slate-100'}`}>{topic.topic_title || topic.title}</h4>
                      <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest break-words">{topic.subjects?.name} • {topic.classes?.name}</p>
                    </div>
                  </div>
                  {topic.status !== 'completed' && (
                    <button 
                      onClick={() => markTopicComplete(topic.id)}
                      className="p-2.5 lg:p-3 bg-slate-800 text-slate-500 rounded-lg lg:rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm shrink-0"
                    >
                      <CheckCircle2 size={18} lg:size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Support Button */}
      <button className="fixed bottom-6 right-6 w-12 h-12 lg:w-14 lg:h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center border border-slate-800 hover:scale-110 active:scale-95 transition-all z-40">
        <Star size={20} lg:size={24} className="text-amber-500 fill-amber-500" />
      </button>
    </div>
  );
};

export default TeacherDashboard;
