import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserX,
  CheckSquare,
  TrendingUp,
  Loader2,
  Calendar,
  Award,
  Target,
  Zap,
  Grid3X3,
  FileText,
  FileSpreadsheet,
  FolderOpen,
  CreditCard,
  Info,
  X,
  Phone,
  ShieldCheck,
  BookOpen,
  PieChart
} from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({ 
    present: 0, 
    absent: 0, 
    participation: 0,
    maleStudents: 0,
    femaleStudents: 0,
    maleTeachers: 0,
    femaleTeachers: 0
  });
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState('Active');
  const [showSubModal, setShowSubModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [pricingIndex, setPricingIndex] = useState(0);

  const pricingTiers = [
    { range: "1 - 400 Students", price: "1,000,000 UGX" },
    { range: "401 - 1,000 Students", price: "1,200,000 UGX" },
    { range: "1,001 - 1,500 Students", price: "1,500,000 UGX" },
    { range: "1,800+ Students", price: "2,000,000 UGX" }
  ];

  useEffect(() => {
    let interval;
    if (showSubModal) {
      interval = setInterval(() => {
        setPricingIndex((prev) => (prev + 1) % pricingTiers.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [showSubModal]);

  useEffect(() => {
    fetchDashboardStats();
    
    let subChannel;

    const setupSubscription = async () => {
      try {
        const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).maybeSingle();
        
        if (profile?.school_id) {
          const { data: schools, error: subError } = await supabase
            .from('schools')
            .select('subscription_status')
            .eq('id', profile.school_id);
          
          if (subError || !schools || schools.length === 0) {
            setSubscriptionStatus('Active');
            return;
          }

          const school = schools[0];
          setSubscriptionStatus(school.subscription_status || 'Inactive');

          if (subChannel) supabase.removeChannel(subChannel);

          subChannel = supabase
            .channel(`dashboard-status-${profile.school_id}-${Math.random().toString(36).substring(7)}`)
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
      } catch (error) {
        setSubscriptionStatus('Active');
      }
    };

    setupSubscription();

    return () => {
      if (subChannel) {
        supabase.removeChannel(subChannel);
      }
    };
  }, [user.id]);

  const fetchDashboardStats = async () => {
    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      const schoolId = profile?.school_id;

      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      // Attendance Stats
      let attendanceQuery = supabase.from('attendance').select('status, student_id');
      if (schoolId) attendanceQuery = attendanceQuery.eq('school_id', schoolId);
      
      const { data: attendanceData } = await attendanceQuery
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      // Group attendance by student to avoid overcounting multiple lessons in a day
      const studentAttendanceMap = attendanceData?.reduce((acc, curr) => {
        if (!acc[curr.student_id]) {
          acc[curr.student_id] = new Set();
        }
        acc[curr.student_id].add(curr.status);
        return acc;
      }, {}) || {};

      let presentCount = 0;
      let absentCount = 0;

      Object.values(studentAttendanceMap).forEach(statuses => {
        if (statuses.has('present')) {
          // If a student was present for even one lesson, they are "On-Site"
          presentCount++;
        } else if (statuses.has('absent')) {
          // Only count as absent if they were NEVER present in any lesson today
          absentCount++;
        }
      });

      // Lesson Stats
      let lessonQuery = supabase.from('lessons').select('status').eq('lesson_date', new Date().toISOString().split('T')[0]);
      if (schoolId) lessonQuery = lessonQuery.eq('school_id', schoolId);
      
      const { data: lessonData } = await lessonQuery;

      const totalLessons = lessonData?.length || 0;
      const completedLessons = lessonData?.filter((l) => l.status === 'completed').length || 0;
      const participationRate =
        totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      // Student Gender Stats
      let studentQuery = supabase.from('students').select('gender');
      if (schoolId) studentQuery = studentQuery.eq('school_id', schoolId);
      const { data: studentData } = await studentQuery;
      
      const maleStudents = studentData?.filter(s => s.gender === 'Male').length || 0;
      const femaleStudents = studentData?.filter(s => s.gender === 'Female').length || 0;

      // Teacher Gender Stats
      let teacherQuery = supabase.from('all_teachers_view').select('gender');
      if (schoolId) teacherQuery = teacherQuery.eq('school_id', schoolId);
      const { data: teacherData } = await teacherQuery;
      
      const maleTeachers = teacherData?.filter(t => t.gender === 'Male').length || 0;
      const femaleTeachers = teacherData?.filter(t => t.gender === 'Female').length || 0;

      setStats({ 
        present: presentCount, 
        absent: absentCount, 
        participation: participationRate,
        maleStudents,
        femaleStudents,
        maleTeachers,
        femaleTeachers
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  /** 4 columns × 3 rows = 12 hub modules */
  const hubItems = [
    { label: 'Students', icon: Users, to: '/students', color: 'border-aurora-cyan text-aurora-cyan shadow-neon-cyan' },
    { label: 'Teachers', icon: UserX, to: '/teachers', color: 'border-aurora-amber text-aurora-amber shadow-neon-amber' },
    { label: 'Guardians', icon: ShieldCheck, to: '/admin/parents', color: 'border-aurora-violet text-aurora-violet shadow-neon-violet' },
    { label: 'Classes', icon: Target, to: '/classes', color: 'border-aurora-violet text-aurora-violet shadow-neon-violet' },
    { label: 'Subjects', icon: Award, to: '/subjects', color: 'border-aurora-rose text-aurora-rose shadow-neon-rose' },
    { label: 'Lessons', icon: Calendar, to: '/lessons', color: 'border-aurora-cyan text-aurora-cyan shadow-neon-cyan' },
    { label: 'Timetables', icon: Grid3X3, to: '/timetables', color: 'border-aurora-emerald text-aurora-emerald shadow-neon-emerald' },
    { label: 'Syllabus', icon: BookOpen, to: '/syllabus', color: 'border-aurora-violet text-aurora-violet shadow-neon-violet' },
    { label: 'Reports', icon: PieChart, to: '/reports', color: 'border-aurora-emerald text-aurora-emerald shadow-neon-emerald' },
    { label: 'Documents', icon: FolderOpen, to: '/documents', color: 'border-aurora-amber text-aurora-amber shadow-neon-amber' },
    { label: 'Export PDF', icon: FileText, to: '/export?format=pdf', color: 'border-aurora-rose text-aurora-rose shadow-neon-rose' },
    { label: 'Export Excel', icon: FileSpreadsheet, to: '/export?format=excel', color: 'border-aurora-cyan text-aurora-cyan shadow-neon-cyan' },
  ];

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-aurora-cyan" size={48} />
      </div>
    );
  }

  const isSubscribed = subscriptionStatus?.toLowerCase() === 'active';

  return (
    <div className="animate-in fade-in zoom-in duration-1000 pb-20 sm:pb-0">
      <div className="glass-card p-6 sm:p-8 lg:p-12 relative overflow-hidden">
        {!isSubscribed && (
          <div className="absolute inset-0 z-20 bg-slate-950/60 backdrop-blur-[3px] flex items-center justify-center p-6 text-center">
            <div className="bg-slate-900 border border-aurora-rose/50 p-8 lg:p-12 rounded-[2.5rem] shadow-neon-rose max-w-sm lg:max-w-md animate-in zoom-in duration-500">
              <ShieldCheck className="text-aurora-rose mx-auto mb-6" size={48} lg:size={64} />
              <h3 className="text-xl lg:text-2xl font-black text-white uppercase tracking-tighter mb-4">Node Deactivated</h3>
              <p className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed mb-8">
                Access to the educational governance matrix is currently restricted due to an inactive subscription.
              </p>
              <button 
                onClick={() => setShowSubModal(true)}
                className="w-full bg-aurora-rose text-white py-4 lg:py-5 rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-[0.3em] shadow-neon-rose hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Renew Subscription
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
          {hubItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = !isSubscribed;
            return (
              <button
                key={item.label}
                type="button"
                disabled={isDisabled}
                onClick={() => navigate(item.to)}
                className={`aspect-square rounded-3xl border-2 flex flex-col items-center justify-center gap-3 sm:gap-5 transition-all duration-500 group relative ${
                  isDisabled 
                    ? 'bg-slate-900/50 border-slate-800 text-slate-700 grayscale' 
                    : `bg-white/5 hover:scale-[1.05] hover:bg-white/10 active:scale-95 ${item.color}`
                }`}
              >
                <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-2xl transition-all duration-500 ${isDisabled ? 'bg-slate-950' : 'bg-white/5 group-hover:rotate-6 group-hover:scale-110'}`}>
                  <Icon className="w-6 h-6 sm:w-9 sm:h-9" />
                </div>
                <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] transition-all px-2 text-center leading-tight break-words max-w-full ${!isDisabled && 'group-hover:tracking-[0.35em]'}`}>
                  {item.label}
                </span>
                {isDisabled && (
                  <div className="absolute top-2 right-2">
                    <X size={12} className="text-slate-700" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile-Only Pill Buttons */}
      <div className="flex flex-col gap-3 mt-8 sm:hidden px-2">
        <button 
          onClick={() => setShowSubModal(true)}
          className={`flex items-center justify-center gap-3 py-4 rounded-full font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-glow border-2 ${
            isSubscribed 
              ? 'bg-aurora-cyan/10 border-aurora-cyan/30 text-aurora-cyan' 
              : 'bg-aurora-rose text-white border-aurora-rose shadow-neon-rose animate-bounce'
          }`}
        >
          <CreditCard size={16} /> 
          {isSubscribed ? 'Subscription: Active' : 'Renew Subscription'}
        </button>
        <button 
          onClick={() => setShowAboutModal(true)}
          className="flex items-center justify-center gap-3 py-4 rounded-full bg-white/5 border-2 border-white/10 text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10"
        >
          <Info size={16} /> About EduTrack UG
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <InsightCard
          label="Total Students"
          value={`${stats.maleStudents + stats.femaleStudents}`}
          subValue={`M: ${stats.maleStudents} | F: ${stats.femaleStudents}`}
          icon={<Users size={24} />}
          color={isSubscribed ? "text-aurora-cyan" : "text-slate-700"}
          glow={isSubscribed ? "shadow-neon-cyan" : ""}
        />
        <InsightCard
          label="Total Teachers"
          value={`${stats.maleTeachers + stats.femaleTeachers}`}
          subValue={`M: ${stats.maleTeachers} | F: ${stats.femaleTeachers}`}
          icon={<UserX size={24} />}
          color={isSubscribed ? "text-aurora-amber" : "text-slate-700"}
          glow={isSubscribed ? "shadow-neon-amber" : ""}
        />
        <InsightCard
          label="On-Site Today"
          value={`${stats.present} Students`}
          subValue={`${stats.absent} Absentees Flagged`}
          icon={<CheckSquare size={24} />}
          color={isSubscribed ? "text-aurora-emerald" : "text-slate-700"}
          glow={isSubscribed ? "shadow-neon-emerald" : ""}
        />
        <InsightCard
          label="Instructional Flow"
          value={`${stats.participation}%`}
          subValue="Daily Syllabus Progress"
          icon={<TrendingUp size={24} />}
          color={isSubscribed ? "text-aurora-rose" : "text-slate-700"}
          glow={isSubscribed ? "shadow-neon-rose" : ""}
        />
      </div>

      {/* Subscription Modal */}
      {showSubModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 h-dvh w-screen overflow-hidden bg-slate-950/95 backdrop-blur-xl">
          <div className="relative bg-slate-950 w-full h-full sm:h-auto sm:max-w-md flex flex-col justify-between p-6 sm:p-10 sm:rounded-[2.5rem] sm:border sm:border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500 overflow-hidden">
            
            {/* Header Section */}
            <div className="text-center space-y-4 pt-4 sm:pt-0">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 mb-6">
                <CreditCard size={24} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent uppercase">
                Institutional Billing
              </h3>
              <p className="text-xs font-semibold tracking-widest text-slate-400 max-w-xs mx-auto text-center uppercase leading-relaxed">
                Maintain your school's access to the digital governance matrix.
              </p>
            </div>
            
            {/* Pricing List - Interchangeable Tiers (5s Loop) */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-8">
              <div className="flex flex-col justify-center relative min-h-[100px] overflow-hidden">
                <div className="relative w-full h-full flex items-center justify-center">
                  {pricingTiers.map((tier, idx) => (
                    <div 
                      key={idx} 
                      className={`absolute inset-0 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 flex items-center justify-between transition-all duration-1000 ease-in-out
                        ${idx === pricingIndex 
                          ? 'opacity-100 scale-100 blur-none' 
                          : 'opacity-0 scale-95 blur-sm pointer-events-none'}`}
                    >
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">Enrollment Range</p>
                        <p className="text-sm font-bold text-slate-200 tracking-wide uppercase">{tier.range}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-cyan-500/50 uppercase tracking-[0.2em] leading-none mb-1">Termly Rate</p>
                        <p className="text-base font-extrabold text-cyan-400 tracking-tight">{tier.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Indicators */}
                <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 flex gap-1.5">
                  {pricingTiers.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`h-1 rounded-full transition-all duration-500 ${idx === pricingIndex ? 'w-4 bg-cyan-500 shadow-neon-cyan' : 'w-1 bg-slate-800'}`}
                    ></div>
                  ))}
                </div>
              </div>

              {/* Payment Method Pill */}
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-lg shadow-red-600/20">A</div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Airtel Money</p>
                    <p className="text-sm font-extrabold text-white tracking-tight tabular-nums">0752 333 216</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">LUZIRA HELLEN</p>
                </div>
              </div>

              {/* Callout Section */}
              <div className="bg-cyan-950/30 border border-cyan-800/30 rounded-xl p-4 text-center">
                <p className="text-[11px] font-medium text-cyan-400 leading-relaxed">
                  After payment, please contact the administrator with your transaction ID for manual verification and node activation.
                </p>
              </div>
            </div>

            {/* Action Buttons Section - Fixed at Bottom */}
            <div className="space-y-3 pt-6 border-t border-white/5 bg-slate-950/50 backdrop-blur-md pb-4 sm:pb-0">
              <button 
                onClick={() => setShowSubModal(false)}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/30 active:scale-[0.98] transition-all"
              >
                Acknowledged
              </button>
              <button 
                onClick={() => setShowSubModal(false)}
                className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all"
              >
                Back to Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 h-dvh w-screen overflow-hidden bg-slate-950/95 backdrop-blur-xl">
          <div className="relative bg-slate-950 w-full h-full sm:h-auto sm:max-w-2xl flex flex-col justify-between p-6 sm:p-10 sm:rounded-[2.5rem] sm:border sm:border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500 overflow-hidden">
            
            {/* Header Section */}
            <div className="text-center space-y-4 pt-4 sm:pt-0">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20 mb-6">
                <Info size={24} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent uppercase">
                EduTrack UG
              </h3>
              <p className="text-xs font-semibold tracking-widest text-slate-400 max-w-xs mx-auto text-center uppercase leading-relaxed">
                The Next-Generation Educational Governance Engine.
              </p>
            </div>
            
            {/* Scrollable Content Section */}
            <div className="flex-1 my-8 overflow-y-auto no-scrollbar space-y-8 pr-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-violet-400">
                  <Zap size={18} />
                  <h4 className="text-sm font-black uppercase tracking-widest">Platform Overview</h4>
                </div>
                <p className="text-xs font-medium text-slate-400 leading-relaxed text-justify">
                  EduTrack UG is a sophisticated, end-to-end institutional management system designed specifically for the unique demands of the modern educational landscape. By integrating advanced data analytics with a sleek, intuitive user interface, we empower administrators, teachers, and stakeholders to govern with absolute precision. Our mission is to eliminate administrative friction and catalyze student success through intelligent automation and real-time monitoring.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Users size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest">Governance Matrix</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Manage the entire student and teacher directory with ease. Track leadership roles, prefect appointments, and staff allocations through a unified digital interface.
                  </p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400">
                    <Target size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest">Academic Tracking</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Input and analyze marks across all subjects. Generate automated performance reports and identify student learning gaps before they become challenges.
                  </p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-violet-400">
                    <Calendar size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest">Dynamic Scheduling</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Automated lesson timetables and syllabus mapping ensure that instructional hours are optimized and academic goals are met on schedule.
                  </p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400">
                    <ShieldCheck size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest">Secure Repository</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Store and organize circulars, memos, and critical school documents in a centralized, encrypted repository accessible only to authorized personnel.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-emerald-400">
                  <CheckSquare size={18} />
                  <h4 className="text-sm font-black uppercase tracking-widest">Instructional Path</h4>
                </div>
                <p className="text-xs font-medium text-slate-400 leading-relaxed text-justify">
                  Using EduTrack UG is seamless. Administrators initialize the institutional node, configure classes, and assign teachers to their respective subject matrices. Teachers then use their dedicated Daily Hub to mark attendance, log lesson progress, and submit marks. All data is synchronized instantly across the network, providing the administration with a 360-degree view of the school's operational health. Whether you are monitoring the "Teaching Index" or exporting detailed performance spreadsheets, every action is designed to be completed in seconds.
                </p>
              </div>

              <div className="pt-4 border-t border-white/5 text-center">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">
                  Developed by Modern Systems Tech <br />
                  v2.0.4-LTS • © 2026 EduTrack UG
                </p>
              </div>
            </div>

            {/* Action Button Section */}
            <div className="pt-4 sm:pt-0">
              <button 
                onClick={() => setShowAboutModal(false)}
                className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-600 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-violet-500/10 hover:shadow-violet-500/30 active:scale-[0.98] transition-all"
              >
                Back to Hub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InsightCard = ({ label, value, subValue, icon, color, glow }) => (
  <div className={`glass-card p-6 lg:p-8 flex items-center justify-between group hover:border-white/20 transition-all ${glow}`}>
    <div className="min-w-0">
      <p className="text-[9px] lg:text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 truncate">{label}</p>
      <p className={`text-xl lg:text-2xl font-black tracking-tight ${color} truncate`}>{value}</p>
      {subValue && <p className="text-[8px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{subValue}</p>}
    </div>
    <div
      className={`w-12 h-12 lg:w-14 lg:h-14 bg-white/5 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 shrink-0 ${color}`}
    >
      {icon}
    </div>
  </div>
);

export default AdminDashboard;
