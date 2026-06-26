import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, User, Star, GraduationCap, ShieldCheck, 
  Calendar, CheckCircle2, Clock, AlertCircle, 
  LogOut, FileText, ChevronRight, Bell, Zap, Menu, X, BookOpen, TrendingUp, Phone, PieChart, Award
} from 'lucide-react';

import PolicyViewerModal from '../../components/parent/PolicyViewerModal';
import CircularViewerModal from '../../components/parent/CircularViewerModal';
import PerformanceChart from '../../components/parent/PerformanceChart';
import { subscribeUserToPush } from '../../lib/pushNotifications';
import { useNotification } from '../../context/NotificationContext';

const ParentDashboard = () => {
  const { profile, refreshProfile } = useAuth();
  const { showNotification } = useNotification();
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const [circulars, setCirculars] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedCircular, setSelectedCircular] = useState(null);
  const [pushStatus, setPushStatus] = useState('idle'); // idle, loading, active, denied
  const [activeView, setActiveView] = useState('home'); // 'home', 'attendance', 'marks', 'analytics', 'broadcasts', 'support'
  const [detailedMarks, setDetailedMarks] = useState([]);
  const [detailedAttendance, setDetailedAttendance] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [schoolSettings, setSchoolSettings] = useState({ marks_sharing_enabled: true });

  // Refs for navigation
  const feedRef = useRef(null);
  const circularsRef = useRef(null);
  const trendsRef = useRef(null);

  const scrollToSection = (ref) => {
    setIsSidebarOpen(false);
    // Add small delay to allow sidebar animation to start closing
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  useEffect(() => {
    checkPushPermission();
    
    let subChannel;

    const setupSubscription = async () => {
      try {
        if (profile?.school_id) {
          const { data: school, error: subError } = await supabase
            .from('schools')
            .select('subscription_status, marks_sharing_enabled')
            .eq('id', profile.school_id)
            .single();
          
          if (!subError && school) {
            setSchoolSettings({ marks_sharing_enabled: school.marks_sharing_enabled });
          }

          if (subChannel) supabase.removeChannel(subChannel);

          subChannel = supabase
            .channel(`dashboard-status-${profile.school_id}-${Math.random().toString(36).substring(7)}`)
            .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'schools',
              filter: `id=eq.${profile.school_id}`
            }, (payload) => {
              // Handle subscription updates if needed
            })
            .subscribe();
        }
      } catch (error) {
        console.error('Subscription setup error:', error);
      }
    };

    if (profile?.phone_number) {
      const loadData = async () => {
        await fetchMyChildren(); // Wait for kids to load first
        await fetchCirculars(); // Then load circulars with kids info
      };
      loadData();
      setupSubscription();
    }

    return () => {
      if (subChannel) {
        supabase.removeChannel(subChannel);
      }
    };
  }, [profile]);

  const fetchDetailedMarks = async (studentId, date) => {
    try {
      // First get student's enrolled subjects
      const currentYear = new Date().getFullYear().toString();
      const { data: enrolledSubjects } = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', studentId)
        .eq('academic_year', currentYear);
      
      const enrolledSubjectIds = new Set(enrolledSubjects?.map(e => e.subject_id) || []);
      
      let query = supabase
        .from('student_marks')
        .select('*, subjects(name), users!student_marks_teacher_id_fkey(full_name)')
        .eq('student_id', studentId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      // Only filter by date if specifically requested (optional for future use)
      // For now, schools prefer seeing all academic data once published
      if (date && activeView !== 'marks') {
        query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter marks to only show enrolled subjects (if there are any assignments)
      let filteredMarks = data || [];
      if (enrolledSubjectIds.size > 0) {
        filteredMarks = filteredMarks.filter(m => enrolledSubjectIds.has(m.subject_id));
      }
      
      setDetailedMarks(filteredMarks);
    } catch (error) {
      console.error('Error fetching detailed marks:', error.message);
    }
  };

  const fetchDetailedAttendance = async (studentId, date) => {
    try {
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (date) {
        query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
      } else {
        query = query.limit(30);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDetailedAttendance(data || []);
    } catch (error) {
      console.error('Error fetching detailed attendance:', error.message);
    }
  };

  useEffect(() => {
    if (activeView === 'marks' && selectedStudent) {
      fetchDetailedMarks(selectedStudent.id, filterDate);
    } else if (activeView === 'attendance' && selectedStudent) {
      fetchDetailedAttendance(selectedStudent.id, filterDate);
    }
  }, [filterDate, activeView, selectedStudent]);

  const hubItems = [
    { 
      label: 'Attendance', 
      icon: CheckCircle2, 
      onClick: () => {
        setFilterDate(new Date().toISOString().split('T')[0]);
        setActiveView('attendance');
      }, 
      color: 'border-emerald-500/30 text-emerald-400 shadow-emerald-500/10' 
    },
    { 
      label: 'Exam Marks', 
      icon: Star, 
      onClick: () => {
        if (!schoolSettings.marks_sharing_enabled) {
          showNotification('Academic scores are currently restricted by the school administration.', 'info');
          return;
        }
        setFilterDate(new Date().toISOString().split('T')[0]);
        setActiveView('marks');
      }, 
      color: `border-amber-500/30 text-amber-400 shadow-amber-500/10 ${!schoolSettings.marks_sharing_enabled ? 'opacity-50 grayscale' : ''}` 
    },
    { 
      label: 'Analytics', 
      icon: TrendingUp, 
      onClick: () => setActiveView('analytics'), 
      color: 'border-violet-500/30 text-violet-400 shadow-violet-500/10' 
    },
    { 
      label: 'Broadcasts', 
      icon: FileText, 
      onClick: () => {
        fetchCirculars();
        setActiveView('broadcasts');
      }, 
      color: 'border-blue-500/30 text-blue-400 shadow-blue-500/10' 
    },
    { 
      label: 'Guidelines', 
      icon: ShieldCheck, 
      onClick: () => setIsPolicyModalOpen(true), 
      color: 'border-rose-500/30 text-rose-400 shadow-rose-500/10' 
    },
    { 
      label: 'Support', 
      icon: Phone, 
      onClick: () => setActiveView('support'), 
      color: 'border-cyan-500/30 text-cyan-400 shadow-cyan-500/10' 
    },
  ];

  const checkPushPermission = async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      setPushStatus('active');
    } else if (Notification.permission === 'denied') {
      setPushStatus('denied');
    }
  };

  const handleEnablePush = async () => {
    try {
      setPushStatus('loading');
      await subscribeUserToPush(profile.id);
      setPushStatus('active');
    } catch (error) {
      console.error('Failed to enable push:', error);
      setPushStatus('denied');
    }
  };

  const fetchCirculars = async () => {
    try {
      // First get my kids
      const myKidsIds = students.map(s => s.id);
      
      // Get all circulars from school_documents
      const { data: schoolDocs, error: schoolDocsError } = await supabase
        .from('school_documents')
        .select('*')
        .eq('school_id', profile.school_id)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (schoolDocsError) throw schoolDocsError;
      
      // Get student reports (permanent storage)
      let studentReports = [];
      try {
        const { data: reportsData, error: reportsError } = await supabase
          .from('student_reports')
          .select('*')
          .in('student_id', myKidsIds)
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (!reportsError && reportsData) {
          studentReports = reportsData.map(report => {
            // Find student name
            const student = students.find(s => s.id === report.student_id);
            const studentName = student?.full_name || 'Student';
            return {
              id: report.id,
              title: `Report Card: ${studentName}`,
              body: report.report_url,
              doc_type: 'report',
              student_id: report.student_id,
              term: report.term,
              year: report.academic_year,
              created_at: report.created_at,
              updated_at: report.published_at || report.created_at
            };
          });
        }
      } catch (reportsError) {
        console.warn('Could not fetch student reports, using school documents only', reportsError);
      }
      
      // Filter school documents to my kids
      const filteredSchoolDocs = schoolDocs?.filter(doc => {
        const isReportCard = doc.title?.startsWith('Report Card:');
        if (!isReportCard) return true; // Show all non-report-card circulars
        
        // Check if this report card belongs to one of my kids
        if (doc.student_id && myKidsIds.includes(doc.student_id)) {
          return true;
        }
        
        // If no student_id, try to match by name in title
        const studentNameInTitle = doc.title?.replace('Report Card: ', '');
        return students.some(s => s.full_name === studentNameInTitle);
      }) || [];

      // Combine, deduplicate, and sort by date
      const allCirculars = [...studentReports, ...filteredSchoolDocs].sort((a, b) => 
        new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
      );
      
      // Deduplicate by title and date to avoid duplicates
      const seen = new Set();
      const uniqueCirculars = allCirculars.filter(doc => {
        const key = `${doc.title}-${doc.created_at || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setCirculars(uniqueCirculars);
    } catch (error) {
      console.error('Error fetching circulars:', error.message);
    }
  };

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentFeed(selectedStudent.id);
      fetchPerformanceHistory(selectedStudent.id);
    }
  }, [selectedStudent]);

  const fetchPerformanceHistory = async (studentId) => {
    try {
      // Clear old data first to avoid flickering with previous child's data
      setPerformanceData([]);
      
      // First get student's enrolled subjects
      const currentYear = new Date().getFullYear().toString();
      const { data: enrolledSubjects } = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', studentId)
        .eq('academic_year', currentYear);
      
      const enrolledSubjectIds = new Set(enrolledSubjects?.map(e => e.subject_id) || []);
      
      const { data, error } = await supabase
        .from('student_marks')
        .select('*, subjects(name)')
        .eq('student_id', studentId)
        .eq('is_published', true)
        .order('created_at', { ascending: true })
        .limit(10); // Increased limit for smarter analytics

      if (error) throw error;
      
      // Filter marks to only show enrolled subjects (if there are any assignments)
      let filteredMarks = data || [];
      if (enrolledSubjectIds.size > 0) {
        filteredMarks = filteredMarks.filter(m => enrolledSubjectIds.has(m.subject_id));
      }
      
      const formatted = filteredMarks.map(m => ({
        label: m.subjects?.name?.substring(0, 3).toUpperCase() || 'TST',
        value: (m.marks / m.max_marks) * 100,
        fullDate: new Date(m.created_at).toLocaleDateString(),
        subject: m.subjects?.name
      }));
      
      setPerformanceData(formatted);
    } catch (error) {
      console.error('Error fetching history:', error.message);
    }
  };

  const fetchMyChildren = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(name), schools(name, type)')
        .eq('parent_phone', profile.phone_number);

      if (error) throw error;
      setStudents(data || []);
      if (data?.length > 0) setSelectedStudent(data[0]);
    } catch (error) {
      console.error('Error fetching children:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentFeed = async (studentId) => {
    try {
      // 1. Fetch Attendance for today
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .gte('created_at', `${today}T00:00:00`);

      // 2. Fetch Latest Marks
      const { data: marks } = await supabase
        .from('student_marks')
        .select('*, subjects(name)')
        .eq('student_id', studentId)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(10); // Show more published marks in feed

      // 3. Combine into a timeline feed
      const newFeed = [
        ...(attendance?.map(a => ({
          type: 'attendance',
          time: new Date(a.created_at),
          title: a.status === 'present' ? 'Arrived at School' : 'Marked Absent',
          status: a.status,
          icon: a.status === 'present' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />
        })) || []),
        ...(marks?.map(m => ({
          type: 'mark',
          time: new Date(m.created_at),
          title: `Published: ${m.subjects?.name}`,
          subtitle: `Score: ${m.marks}/${m.max_marks}`,
          status: 'academic',
          icon: <Star size={16} />
        })) || [])
      ].sort((a, b) => b.time - a.time);

      setFeed(newFeed);
    } catch (error) {
      console.error('Error fetching feed:', error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 bg-primary-600/20 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <ShieldCheck className="text-primary-400" size={32} />
        </div>
        <p className="text-slate-500 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Synchronizing Node...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans relative overflow-x-hidden">
      {/* Background Blurs */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600 rounded-full blur-[120px]"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/50 backdrop-blur-2xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-glow">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none uppercase">EduTrack <span className="text-primary-400">Guardian</span></h1>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">{profile.schools?.name}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/10"
        >
          <Menu size={20} />
        </button>
      </header>

      <main className="p-6 space-y-8 relative z-10 max-w-lg mx-auto pb-24">
        {activeView === 'home' ? (
          <>
            {/* The Pulse: Push Notification Onboarding */}
            {pushStatus !== 'active' && pushStatus !== 'denied' && (
              <div className="bg-gradient-to-br from-primary-600/20 to-violet-600/20 border border-primary-500/30 rounded-[2rem] p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16 animate-pulse"></div>
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center shadow-glow shrink-0">
                    <Bell className="text-white animate-bounce" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black uppercase tracking-widest leading-none">Activate The Pulse</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">
                      Receive real-time alerts for attendance, scores & circulars.
                    </p>
                    <button 
                      onClick={handleEnablePush}
                      disabled={pushStatus === 'loading'}
                      className="mt-4 bg-white text-slate-950 px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:scale-[1.05] transition-all disabled:opacity-50"
                    >
                      {pushStatus === 'loading' ? 'Activating Node...' : 'Enable Notifications'}
                    </button>
                  </div>
                  <button 
                    onClick={() => setPushStatus('denied')}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Child Selector (If multiple children) */}
            {students.length > 1 && (
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 -mx-2 px-2 scroll-smooth">
                {students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className={`flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all whitespace-nowrap shrink-0 group ${
                      selectedStudent?.id === s.id 
                        ? 'bg-primary-600 border-primary-500 text-white shadow-glow' 
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-colors ${
                      selectedStudent?.id === s.id ? 'bg-white/20' : 'bg-white/10 group-hover:bg-white/20'
                    }`}>
                      {s.full_name.substring(0,1).toUpperCase()}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">{s.full_name.split(' ')[0]}</span>
                      <div className="flex flex-col items-start gap-0.5 mt-1">
                        <span className={`text-[7px] font-black uppercase tracking-tighter ${
                          selectedStudent?.id === s.id ? 'text-white/60' : 'text-slate-600'
                        }`}>{s.classes?.name}</span>
                        {s.schools?.type && (
                          <span className={`text-[6px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            s.schools.type === 'primary' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-400'
                          }`}>
                            {s.schools.type} • {s.schools?.name?.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Hero Status Card */}
            {selectedStudent && (
              <div className="glass-card p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary-600/20 transition-colors"></div>
                <div className="flex items-start justify-between relative z-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0">
                        <User size={28} className="text-primary-400 sm:size-32" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight break-words leading-tight">{selectedStudent.full_name}</h2>
                        <p className="text-[9px] sm:text-[10px] font-black text-primary-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                          <GraduationCap size={12} className="shrink-0" /> {selectedStudent.classes?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active Cycle 2026</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hub Navigation Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {hubItems.map((item) => {
                const Icon = item.icon;
                const hasUpdates = item.label === 'Exam Marks' && detailedMarks.length > 0;
                
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={`aspect-square rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all duration-300 group bg-white/5 hover:bg-white/10 active:scale-95 relative ${item.color}`}
                  >
                    {hasUpdates && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-glow"></div>
                    )}
                    <div className="p-4 rounded-2xl bg-white/5 group-hover:rotate-6 group-hover:scale-110 transition-all duration-300">
                      <Icon size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center px-2 leading-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Smart Timeline Feed */}
            {feed.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Live Pulse</h3>
                  <div className="h-[1px] flex-1 bg-white/5 mx-4"></div>
                </div>
                <div className="space-y-4">
                  {feed.map((item, idx) => (
                    <div key={idx} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                          item.type === 'attendance' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          {item.icon}
                        </div>
                        {idx !== feed.length - 1 && <div className="w-[1px] flex-1 bg-white/5 my-2"></div>}
                      </div>
                      <div className="flex-1 pt-1 pb-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-200">{item.title}</h4>
                            {item.subtitle && <p className="text-[10px] font-black text-primary-400 mt-1 uppercase tracking-widest">{item.subtitle}</p>}
                            <p className="text-[8px] font-black text-slate-600 mt-2 uppercase tracking-widest">
                              {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(item.time).toLocaleDateString()}
                            </p>
                          </div>
                          <ChevronRight size={14} className="text-slate-700 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Back Header */}
            <div className="flex items-center justify-between mb-8">
              <button 
                onClick={() => setActiveView('home')}
                className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors group"
              >
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center group-hover:bg-white/10">
                  <ChevronRight size={16} className="rotate-180" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Back to Hub</span>
              </button>
              <div className="text-right">
                <h2 className="text-sm font-black uppercase tracking-widest text-primary-400">{activeView}</h2>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-0.5">{selectedStudent?.full_name.split(' ')[0]}</p>
              </div>
            </div>

            {/* View Specific Content */}
            {activeView === 'attendance' && (
              <div className="space-y-6">
                <div className="glass-card p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                      <CheckCircle2 size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Daily Logs</span>
                  </div>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-emerald-500/50 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-3">
                  {detailedAttendance.length === 0 ? (
                    <div className="bg-white/5 rounded-[2rem] p-12 text-center border border-white/5 border-dashed">
                      <Clock className="text-slate-800 mx-auto mb-4" size={32} />
                      <p className="text-slate-600 font-black text-[10px] uppercase tracking-widest leading-relaxed">No attendance logs found for this specific date</p>
                    </div>
                  ) : (
                    detailedAttendance.map((a, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                          <p className="text-sm font-bold text-slate-200">{new Date(a.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">{new Date(a.created_at).toLocaleTimeString()}</p>
                        </div>
                        <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${
                          a.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {a.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeView === 'marks' && (
              <div className="space-y-6">
                <div className="glass-card p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
                      <Star size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Academic Data</span>
                  </div>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-amber-500/50 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-4">
                  {detailedMarks.length === 0 ? (
                    <div className="bg-white/5 rounded-[2rem] p-12 text-center border border-white/5 border-dashed">
                      <Award className="text-slate-800 mx-auto mb-4" size={32} />
                      <p className="text-slate-600 font-black text-[10px] uppercase tracking-widest leading-relaxed">No marks submitted for this specific cycle</p>
                    </div>
                  ) : (
                    detailedMarks.map((m, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center justify-between group hover:border-amber-500/30 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">{m.subjects?.name}</p>
                          <div className="flex items-center gap-2">
                            <User size={10} className="text-slate-600" />
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Teacher: {m.users?.full_name || 'System'}</p>
                          </div>
                          <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mt-1">Logged {new Date(m.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-black text-amber-400">{m.marks}<span className="text-slate-600 text-xs">/{m.max_marks}</span></p>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Grade Index</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeView === 'analytics' && (
              <div className="space-y-6">
                <div className="glass-card p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Academic Matrix</h3>
                      <p className="text-[8px] font-black text-primary-400 uppercase tracking-widest mt-1">Specific Node: {selectedStudent?.full_name.split(' ')[0]}</p>
                    </div>
                    <div className="bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 rounded-xl">
                      <TrendingUp size={14} className="text-primary-400" />
                    </div>
                  </div>
                  <PerformanceChart data={performanceData} />
                  <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest text-center mt-6">Showing last {performanceData.length} assessment cycles</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors"></div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <CheckCircle2 size={10} className="text-emerald-500" /> Consistency
                    </p>
                    <p className="text-2xl font-black text-emerald-400">
                      {detailedAttendance.length > 0 
                        ? `${Math.round((detailedAttendance.filter(a => a.status === 'present').length / detailedAttendance.length) * 100)}%` 
                        : 'N/A'}
                    </p>
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mt-1">Presence Index</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-violet-500/5 rounded-full blur-xl group-hover:bg-violet-500/10 transition-colors"></div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Star size={10} className="text-violet-500" /> Mastery
                    </p>
                    <p className="text-2xl font-black text-violet-400">
                      {performanceData.length > 0
                        ? (Math.max(...performanceData.map(d => d.value)) > 80 ? 'Elite' : 'Stable')
                        : 'N/A'}
                    </p>
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mt-1">Performance Tier</p>
                  </div>
                </div>

                {/* Insight Node */}
                <div className="bg-primary-600/10 border border-primary-500/20 p-6 rounded-[2rem]">
                  <div className="flex items-center gap-3 mb-3">
                    <Zap size={16} className="text-primary-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Smart Insight</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-300 leading-relaxed uppercase">
                    {performanceData.length > 0 
                      ? `Based on the latest assessment in ${performanceData[performanceData.length - 1].subject}, ${selectedStudent?.full_name.split(' ')[0]} is maintaining a ${performanceData[performanceData.length - 1].value}% efficiency rate. Attendance is ${detailedAttendance.filter(a => a.status === 'present').length > detailedAttendance.length * 0.9 ? 'excellent' : 'regular'}.`
                      : 'Insufficient data for a smart insight node. Continue tracking attendance and marks to generate analytics.'}
                  </p>
                </div>
              </div>
            )}

            {activeView === 'broadcasts' && (
              <div className="space-y-4">
                {circulars.length === 0 ? (
                  <div className="bg-white/5 rounded-[2rem] p-12 text-center border border-white/5 border-dashed">
                    <p className="text-slate-600 font-black text-[9px] uppercase tracking-widest">No active circulars from administration</p>
                  </div>
                ) : (
                  circulars.map(doc => (
                    <button 
                      key={doc.id}
                      onClick={() => setSelectedCircular(doc)}
                      className="w-full flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                          <FileText size={24} />
                        </div>
                        <div className="text-left">
                          <span className="text-[10px] font-black uppercase tracking-widest block truncate max-w-[200px]">{doc.title}</span>
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Published {new Date(doc.updated_at || doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-600 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))
                )}
              </div>
            )}

            {activeView === 'support' && (
              <div className="glass-card p-8 text-center space-y-8">
                <div className="w-24 h-24 bg-cyan-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto border border-cyan-500/20">
                  <ShieldCheck className="text-cyan-400" size={48} />
                </div>
                <div>
                  <h4 className="text-xl font-black tracking-tight mb-3 uppercase">{profile.schools?.name}</h4>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed px-4">
                    Direct access to the educational governance support node. Use these channels for administrative or technical assistance.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Admin Contact</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">School Office</span>
                  </div>
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Core Engine</span>
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">v2.0.4-AURORA</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        <PolicyViewerModal 
          isOpen={isPolicyModalOpen} 
          onClose={() => setIsPolicyModalOpen(false)} 
          schoolId={profile.school_id}
        />
        <CircularViewerModal 
          isOpen={!!selectedCircular}
          onClose={() => setSelectedCircular(null)}
          doc={selectedCircular}
        />
      </main>

      {/* Navigation Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl animate-in fade-in" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-72 bg-slate-900 h-full border-l border-white/10 p-8 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-lg font-black uppercase tracking-tighter">Settings</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400"><X size={20} /></button>
            </div>
            
            <div className="space-y-4 flex-1">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Guardian Node</p>
                <p className="text-sm font-black text-white">{profile.full_name}</p>
              </div>
              <button 
                onClick={() => { setActiveView('attendance'); setIsSidebarOpen(false); }}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <Bell size={18} /> Notifications
              </button>
              <button 
                onClick={() => { setActiveView('analytics'); setIsSidebarOpen(false); }}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <Star size={18} /> Performance Trends
              </button>
              <button 
                onClick={() => { setActiveView('broadcasts'); setIsSidebarOpen(false); }}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <FileText size={18} /> School Broadcasts
              </button>
              <button 
                onClick={() => { setIsSidebarOpen(false); setIsPolicyModalOpen(true); }}
                className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <ShieldCheck size={18} /> School Charter
              </button>
            </div>

            <button 
              onClick={handleLogout}
              className="mt-auto w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
            >
              <LogOut size={16} /> Authorize Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
