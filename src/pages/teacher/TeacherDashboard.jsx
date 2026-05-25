import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus, queueOfflineAction, useOfflineSync } from '../../lib/offline';
import { 
  LogOut, BookOpen, Clock, Star, Target, 
  CheckCircle2, XCircle, ChevronLeft, ListChecks,
  Calendar, GraduationCap, Zap, User, ArrowRight,
  ClipboardList, Loader2, WifiOff, CloudUpload, ShieldCheck, X, History, FileSpreadsheet, Quote
} from 'lucide-react';

const TeacherDashboard = () => {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState('home'); 
  const [lessons, setLessons] = useState([]);
  const [motivationQuotes, setMotivationQuotes] = useState([]);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [historyAttendance, setHistoryAttendance] = useState([]);
  const [historyMarks, setHistoryMarks] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterGender, setFilterGender] = useState('all');
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

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const teacherGuidelines = `Institutional Staff Operational Charter

Welcome to the EduTrack UG Staff Node. As an educator within our ecosystem, your role is pivotal in maintaining the integrity and real-time accuracy of the educational governance matrix. By accessing this terminal, you agree to adhere to the following professional guidelines.

1. Real-Time Data Integrity: All attendance logs and academic scores submitted must be accurate and verified. You are the primary node for data entry, and your submissions directly impact parent notifications and institutional analytics.

2. Professional Confidentiality: Student data accessible through this portal—including academic performance and attendance history—is strictly confidential. You must not share, export, or discuss this information outside of authorized institutional channels.

3. Timely Synchronization: To ensure "The Pulse" functions effectively for parents, teachers are expected to finalize attendance records within 30 minutes of the session start. Academic marks should be synchronized within 48 hours of assessment completion.

4. Offline Mode Protocol: When working in areas with restricted connectivity, the system will automatically queue your actions. It is your responsibility to ensure the terminal is brought online periodically to finalize the synchronization of local data to the cloud.

5. Ethical Usage: This portal is an instructional tool. Any attempt to manipulate records, bypass security protocols, or use the system for non-educational purposes will result in immediate deactivation of your staff node.

6. Security Compliance: Maintain the security of your access credentials. Never share your password or leave your terminal unattended while logged into the Staff Node.

By continuing to use the EduTrack Staff Terminal, you acknowledge your responsibility as a guardian of educational data and a key facilitator of the EduTrack UG mission.`;

  useEffect(() => {
    fetchMotivationQuotes();
  }, []);

  useEffect(() => {
    if (motivationQuotes.length > 0) {
      const interval = setInterval(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % motivationQuotes.length);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [motivationQuotes]);

  const fetchMotivationQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('teacher_quotes')
        .select('*');
      if (error) throw error;
      setMotivationQuotes(data || []);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  };

  const fetchAttendanceHistory = async (classId, date) => {
    try {
      setHistoryLoading(true);
      // Determine if we should filter by class or if it's not present in the table
      const { data, error } = await supabase
        .from('attendance')
        .select('*, students(full_name, class_id)')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`);

      if (error) throw error;

      // Filter by class_id manually if the attendance table doesn't have it directly
      const filteredData = classId 
        ? data.filter(a => a.students?.class_id === classId)
        : data;

      setHistoryAttendance(filteredData || []);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchMarksHistory = async (classId, subjectId, date) => {
    try {
      setHistoryLoading(true);
      let query = supabase
        .from('student_marks')
        .select('*, students!inner(full_name, class_id)')
        .eq('students.class_id', classId)
        .eq('subject_id', subjectId);

      if (date) {
        query = query.gte('created_at', `${date}T00:00:00`)
                     .lte('created_at', `${date}T23:59:59`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setHistoryMarks(data || []);
    } catch (error) {
      console.error('Error fetching marks history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance_history' && selectedClass) {
      fetchAttendanceHistory(selectedClass, filterDate);
    } else if (activeTab === 'marks_history' && selectedClass && selectedSubject) {
      fetchMarksHistory(selectedClass, selectedSubject, filterDate);
    }
  }, [activeTab, selectedClass, selectedSubject, filterDate]);

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
      
      const records = Object.entries(marks)
        .filter(([_, score]) => score !== '' && !isNaN(parseFloat(score)))
        .map(([studentId, score]) => ({
          student_id: studentId,
          subject_id: selectedSubject,
          teacher_id: user.id,
          marks: parseFloat(score),
          max_marks: 100,
          school_id: profile.school_id,
          year: 2026,
          term: 'Term 1' // Default term
        }));

      if (records.length === 0) {
        alert("Please enter at least one valid score.");
        setSubmittingMarks(false);
        return;
      }

      if (!isOnline) {
        queueOfflineAction('SUBMIT_MARKS', { records });
        alert("Working Offline: Marks saved locally and will sync later.");
      } else {
        const { error } = await supabase.from('student_marks').insert(records);
        if (error) {
          console.error("Marks submission error:", error);
          throw new Error(error.message || "Failed to submit marks to database");
        }
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
    if (error) {
      console.error("Attendance submission error:", error);
      alert("Error: " + (error.message || "Failed to finalize record"));
    } else {
      await supabase.from('lessons').update({ status: 'completed' }).eq('id', activeLesson.id);
      setActiveLesson(null);
      fetchTeacherData();
      alert("Success: Attendance finalized!");
    }
    setLoading(false);
  };

  const markTopicComplete = async (topicId) => {
    const { error } = await supabase.from('syllabus_topics').update({ status: 'completed', completed_at: new Date() }).eq('id', topicId);
    if (!error) { fetchTeacherData(); }
  };

  const isSubscribed = subscriptionStatus?.toLowerCase() === 'active';

  if (activeLesson) {
    const filteredStudents = students.filter(s => filterGender === 'all' || s.gender === filterGender);
    const presentMales = students.filter(s => s.gender === 'Male' && !absentees.includes(s.id)).length;
    const presentFemales = students.filter(s => s.gender === 'Female' && !absentees.includes(s.id)).length;
    const totalMales = students.filter(s => s.gender === 'Male').length;
    const totalFemales = students.filter(s => s.gender === 'Female').length;

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 lg:w-14 lg:h-14 bg-primary-600/10 text-primary-400 rounded-2xl flex items-center justify-center shrink-0 border border-primary-500/20 shadow-glow">
                  <ClipboardList size={24} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight truncate">{activeLesson.classes?.name}</h2>
                  <p className="text-slate-500 font-bold text-[10px] lg:text-sm uppercase tracking-widest truncate">{activeLesson.subjects?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
                <div className="flex flex-col items-center px-3 border-r border-slate-800">
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Males Present</span>
                  <span className="text-lg font-black text-blue-400 leading-none">{presentMales}<span className="text-[10px] text-slate-600 ml-1">/{totalMales}</span></span>
                </div>
                <div className="flex flex-col items-center px-3">
                  <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Females Present</span>
                  <span className="text-lg font-black text-rose-400 leading-none">{presentFemales}<span className="text-[10px] text-slate-600 ml-1">/{totalFemales}</span></span>
                </div>
              </div>
            </div>
            
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 lg:p-4 rounded-2xl flex items-center justify-between relative z-10 shadow-rose-glow mt-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shrink-0"></div>
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-tight">Mark students who are ABSENT</p>
              </div>
              <select 
                className="bg-slate-900/50 border border-rose-500/20 rounded-xl px-3 py-1 text-[9px] font-black text-rose-400 uppercase tracking-widest focus:outline-none"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <option value="all">All Genders</option>
                <option value="Male">Males Only</option>
                <option value="Female">Females Only</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-32">
            {filteredStudents.map(s => (
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
                  <div className="flex items-center gap-2">
                    <span className={`block font-black tracking-tight text-sm lg:text-base truncate ${absentees.includes(s.id) ? 'text-rose-400' : 'text-slate-100'}`}>
                      {s.full_name}
                    </span>
                    {s.gender && (
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${s.gender === 'Male' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {s.gender === 'Male' ? 'M' : 'F'}
                      </span>
                    )}
                  </div>
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

        {/* Motivation Quote Node */}
        {activeTab === 'home' && motivationQuotes.length > 0 && (
          <div className="bg-gradient-to-br from-primary-600/10 to-violet-600/10 border border-primary-500/20 rounded-[2rem] p-8 relative overflow-hidden group animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-500/10 transition-colors"></div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3 text-primary-400">
                <Quote size={20} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Staff Inspiration Node</span>
              </div>
              <p className="text-base lg:text-lg font-black tracking-tight leading-relaxed italic text-slate-200">
                "{motivationQuotes[currentQuoteIndex]?.content}"
              </p>
              <div className="flex items-center justify-between pt-2">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">— {motivationQuotes[currentQuoteIndex]?.author || 'Institutional Governance'}</p>
                <div className="flex gap-1">
                  {motivationQuotes.slice(0, 5).map((_, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === currentQuoteIndex % 5 ? 'w-4 bg-primary-500' : 'w-1 bg-white/10'}`}></div>
                  ))}
                </div>
              </div>
            </div>
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

        {/* Hub Navigation Grid (3x2) */}
        {activeTab === 'home' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-6 animate-in zoom-in duration-500">
            <button 
              onClick={() => setActiveTab('schedule')}
              className="aspect-square bg-slate-900 border-2 border-emerald-500/30 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col items-center justify-center gap-3 lg:gap-4 transition-all hover:bg-emerald-500/5 hover:border-emerald-500/50 group active:scale-95 shadow-emerald-500/10"
            >
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-emerald-500/10 rounded-2xl lg:rounded-3xl flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Clock size={28} lg:size={32} />
              </div>
              <span className="text-[9px] lg:text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Daily Hub</span>
            </button>

            <button 
              onClick={() => setActiveTab('grades')}
              className="aspect-square bg-slate-900 border-2 border-amber-500/30 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col items-center justify-center gap-3 lg:gap-4 transition-all hover:bg-amber-500/5 hover:border-amber-500/50 group active:scale-95 shadow-amber-500/10"
            >
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-amber-500/10 rounded-2xl lg:rounded-3xl flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Target size={28} lg:size={32} />
              </div>
              <span className="text-[9px] lg:text-xs font-black uppercase tracking-[0.2em] text-amber-400">Add Results</span>
            </button>

            <button 
              onClick={() => {
                setSelectedClass('');
                setActiveTab('attendance_history');
              }}
              className="aspect-square bg-slate-900 border-2 border-emerald-500/30 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col items-center justify-center gap-3 lg:gap-4 transition-all hover:bg-emerald-500/5 hover:border-emerald-500/50 group active:scale-95 shadow-emerald-500/10"
            >
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-emerald-500/10 rounded-2xl lg:rounded-3xl flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <History size={28} lg:size={32} />
              </div>
              <span className="text-[9px] lg:text-xs font-black uppercase tracking-[0.2em] text-emerald-400 text-center px-1 leading-tight">Attendance Logs</span>
            </button>

            <button 
              onClick={() => {
                setSelectedClass('');
                setSelectedSubject('');
                setActiveTab('marks_history');
              }}
              className="aspect-square bg-slate-900 border-2 border-amber-500/30 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col items-center justify-center gap-3 lg:gap-4 transition-all hover:bg-amber-500/5 hover:border-amber-500/50 group active:scale-95 shadow-amber-500/10"
            >
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-amber-500/10 rounded-2xl lg:rounded-3xl flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <FileSpreadsheet size={28} lg:size={32} />
              </div>
              <span className="text-[9px] lg:text-xs font-black uppercase tracking-[0.2em] text-amber-400 text-center px-1 leading-tight">Marks Archive</span>
            </button>

            <button 
              onClick={() => setActiveTab('syllabus')}
              className="aspect-square bg-slate-900 border-2 border-violet-500/30 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col items-center justify-center gap-3 lg:gap-4 transition-all hover:bg-violet-500/5 hover:border-violet-500/50 group active:scale-95 shadow-violet-500/10"
            >
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-violet-500/10 rounded-2xl lg:rounded-3xl flex items-center justify-center text-violet-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <ListChecks size={28} lg:size={32} />
              </div>
              <span className="text-[9px] lg:text-xs font-black uppercase tracking-[0.2em] text-violet-400">Syllabus Map</span>
            </button>

            <button 
              onClick={() => setIsPolicyModalOpen(true)}
              className="aspect-square bg-slate-900 border-2 border-primary-500/30 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col items-center justify-center gap-3 lg:gap-4 transition-all hover:bg-primary-500/5 hover:border-primary-500/50 group active:scale-95 shadow-primary-500/10"
            >
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-primary-500/10 rounded-2xl lg:rounded-3xl flex items-center justify-center text-primary-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <ShieldCheck size={28} lg:size={32} />
              </div>
              <span className="text-[9px] lg:text-xs font-black uppercase tracking-[0.2em] text-primary-400">Staff Charter</span>
            </button>
          </div>
        )}

        {/* Back to Hub Header for Views */}
        {activeTab !== 'home' && (
          <div className="flex items-center justify-between mb-8 animate-in slide-in-from-left duration-300">
            <button 
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors group"
            >
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-white/10">
                <ChevronLeft size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Return to Hub</span>
            </button>
            <div className="text-right">
              <h2 className="text-sm font-black uppercase tracking-widest text-primary-400">
                {activeTab === 'schedule' ? 'Daily Hub' : 
                 activeTab === 'grades' ? 'Add Results' : 
                 activeTab === 'attendance_history' ? 'Attendance Logs' :
                 activeTab === 'marks_history' ? 'Marks Archive' : 
                 'Syllabus Map'}
              </h2>
            </div>
          </div>
        )}

        {/* Dynamic Content */}
        <div className="space-y-6">
          {activeTab === 'schedule' && (
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
          )}

          {activeTab === 'grades' && (
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
                  <div className="p-6 border-b border-slate-800 bg-slate-950/30 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Marks Entry Matrix</h3>
                    <select 
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest focus:outline-none"
                      value={filterGender}
                      onChange={(e) => setFilterGender(e.target.value)}
                    >
                      <option value="all">All Genders</option>
                      <option value="Male">Males</option>
                      <option value="Female">Females</option>
                    </select>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {students.filter(s => filterGender === 'all' || s.gender === filterGender).map(s => (
                      <div key={s.id} className="p-4 lg:p-6 flex items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center font-black text-xs">
                            {s.full_name.substring(0, 1).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-200 text-sm lg:text-base">{s.full_name}</span>
                              {s.gender && (
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${s.gender === 'Male' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                  {s.gender === 'Male' ? 'M' : 'F'}
                                </span>
                              )}
                            </div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{s.gender || 'Not Specified'}</span>
                          </div>
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
          )}

          {activeTab === 'syllabus' && (
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

          {activeTab === 'attendance_history' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="glass-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest">Attendance Archive</h3>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Select Class & Date to view logs</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select 
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-emerald-500/50 transition-all"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-emerald-500/50 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>

              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="text-emerald-500 animate-spin" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Retrieving Logs...</p>
                </div>
              ) : historyAttendance.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-[2.5rem] p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-700">
                    <History size={32} />
                  </div>
                  <p className="text-slate-600 font-black text-[10px] uppercase tracking-widest leading-relaxed px-8">No attendance records found for the selected parameters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl text-center">
                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Attended</p>
                      <p className="text-2xl font-black text-emerald-400">{historyAttendance.filter(a => a.status === 'present').length}</p>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl text-center">
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Missed</p>
                      <p className="text-2xl font-black text-rose-400">{historyAttendance.filter(a => a.status === 'absent').length}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-white/5 bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                    {historyAttendance.map((a, idx) => (
                      <div key={idx} className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${a.status === 'present' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {a.students?.full_name.substring(0, 1).toUpperCase()}
                          </div>
                          <span className="text-sm font-black text-slate-200">{a.students?.full_name}</span>
                        </div>
                        <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${a.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'marks_history' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="glass-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest">Marks Archive</h3>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Historical Performance Matrix</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select 
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-amber-500/50 transition-all"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    <option value="">Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select 
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-amber-500/50 transition-all"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <option value="">Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-amber-500/50 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>

              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="text-amber-500 animate-spin" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Retrieving Matrix...</p>
                </div>
              ) : historyMarks.length === 0 ? (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-[2.5rem] p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-700">
                    <FileSpreadsheet size={32} />
                  </div>
                  <p className="text-slate-600 font-black text-[10px] uppercase tracking-widest leading-relaxed px-8">No score records found for the selected parameters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden divide-y divide-white/5">
                    {historyMarks.map((m, idx) => (
                      <div key={idx} className="p-6 flex items-center justify-between hover:bg-white/5 transition-all group">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-slate-200">{m.students?.full_name}</p>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Logged {new Date(m.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-amber-400 group-hover:scale-110 transition-transform">{m.marks}<span className="text-slate-600 text-[10px]">/{m.max_marks}</span></p>
                          <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Score Matrix</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Modals */}
        {isPolicyModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
            <div className="glass-card w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-primary-400" size={24} />
                  <div>
                    <h3 className="font-black uppercase tracking-tight text-lg">Staff Operational Charter</h3>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Rules of Engagement & Professional Conduct</p>
                  </div>
                </div>
                <button onClick={() => setIsPolicyModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-900/50">
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-slate-300 font-medium leading-relaxed text-sm sm:text-base">
                    {teacherGuidelines}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Verified Institutional Protocol</span>
                </div>
                <button 
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="px-8 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-glow"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Support Button */}
      <button className="fixed bottom-6 right-6 w-12 h-12 lg:w-14 lg:h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center border border-slate-800 hover:scale-110 active:scale-95 transition-all z-40">
        <Star size={20} lg:size={24} className="text-amber-500 fill-amber-500" />
      </button>
    </div>
  );
};

export default TeacherDashboard;
