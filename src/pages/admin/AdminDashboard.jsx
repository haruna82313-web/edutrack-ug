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
  PieChart,
  Mail,
  User
} from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const schoolType = profile?.schools?.type || 'secondary';
  const isPrimary = schoolType === 'primary';
  
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
  const [showHowToModal, setShowHowToModal] = useState(false);
  const [pricingIndex, setPricingIndex] = useState(0);

  const pricingTiers = [
    { 
      name: "Starter", 
      range: "1 - 1000 Students", 
      price: "3,500,000 UGX",
      valueProps: ["Core Features (Attendance, Marks, Parent Portal)", "Standard Email Support"]
    },
    { 
      name: "Growth", 
      range: "1001 - 1500 Students", 
      price: "4,200,000 UGX",
      valueProps: ["Everything in Starter", "Report Cards & Basic Analytics", "Priority 48hr Support"]
    },
    { 
      name: "Enterprise", 
      range: "1501+ Students", 
      price: "5,000,000 UGX",
      valueProps: ["Everything in Growth", "Custom Branding (PDFs & Portal)", "24/7 Priority Support", "Multi-Campus Support"]
    }
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

      // Student Gender Stats (only active)
      let studentQuery = supabase.from('students').select('gender');
      if (schoolId) studentQuery = studentQuery.eq('school_id', schoolId);
      studentQuery = studentQuery.eq('status', 'active');
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
    // Row 1: Green
    { 
      label: 'Students', 
      icon: Users, 
      to: '/students', 
      color: isPrimary ? 'border-emerald-500 text-emerald-400' : 'border-aurora-cyan text-aurora-cyan' 
    },
    { 
      label: 'Teachers', 
      icon: UserX, 
      to: '/teachers', 
      color: isPrimary ? 'border-emerald-500 text-emerald-400' : 'border-aurora-amber text-aurora-amber' 
    },
    { 
      label: 'Guardians', 
      icon: ShieldCheck, 
      to: '/admin/parents', 
      color: isPrimary ? 'border-emerald-500 text-emerald-400' : 'border-aurora-violet text-aurora-violet' 
    },
    { 
      label: 'Classes', 
      icon: Target, 
      to: '/classes', 
      color: isPrimary ? 'border-emerald-500 text-emerald-400' : 'border-aurora-violet text-aurora-violet' 
    },
    // Row 2: Gold/Amber
    { 
      label: 'Subjects', 
      icon: Award, 
      to: '/subjects', 
      color: isPrimary ? 'border-amber-500 text-amber-400' : 'border-aurora-rose text-aurora-rose' 
    },
    { 
      label: 'Lessons', 
      icon: Calendar, 
      to: '/lessons', 
      color: isPrimary ? 'border-amber-500 text-amber-400' : 'border-aurora-cyan text-aurora-cyan' 
    },
    { 
      label: 'Timetables', 
      icon: Grid3X3, 
      to: '/timetables', 
      color: isPrimary ? 'border-amber-500 text-amber-400' : 'border-aurora-emerald text-aurora-emerald' 
    },
    { 
      label: 'Syllabus', 
      icon: BookOpen, 
      to: '/syllabus', 
      color: isPrimary ? 'border-amber-500 text-amber-400' : 'border-aurora-violet text-aurora-violet' 
    },
    // Row3: Blue
    { 
      label: 'Reports', 
      icon: PieChart, 
      to: '/reports', 
      color: isPrimary ? 'border-blue-500 text-blue-400' : 'border-aurora-emerald text-aurora-emerald' 
    },
    { 
      label: 'Documents', 
      icon: FolderOpen, 
      to: '/documents', 
      color: isPrimary ? 'border-blue-500 text-blue-400' : 'border-aurora-amber text-aurora-amber' 
    },
    { 
      label: 'Export PDF', 
      icon: FileText, 
      to: '/export?format=pdf', 
      color: isPrimary ? 'border-blue-500 text-blue-400' : 'border-aurora-rose text-aurora-rose' 
    },
    { 
      label: 'Export Excel', 
      icon: FileSpreadsheet, 
      to: '/export?format=excel', 
      color: isPrimary ? 'border-blue-500 text-blue-400' : 'border-aurora-cyan text-aurora-cyan' 
    },
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
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
          {hubItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = !isSubscribed;
            return (
              <button
                key={item.label}
                type="button"
                disabled={isDisabled}
                onClick={() => navigate(item.to)}
                className={`aspect-square bg-slate-900 border-2 rounded-2xl lg:rounded-[2rem] flex flex-col items-center justify-center gap-2 lg:gap-3 transition-all duration-300 group relative active:scale-95 ${
                  isDisabled 
                    ? 'border-slate-800 text-slate-700 grayscale' 
                    : `${item.color} hover:bg-white/5 hover:border-current/50`
                }`}
              >
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isDisabled ? 'bg-slate-950' : 'bg-white/5 group-hover:scale-110 group-hover:rotate-6'
                }`}>
                  <Icon size={22} lg={28} />
                </div>
                <span className={`text-[8px] lg:text-[9px] font-black uppercase tracking-[0.2em] text-center px-1 leading-tight ${
                  !isDisabled ? item.color.split(' ')[1] : ''
                }`}>
                  {item.label}
                </span>
                {isDisabled && (
                  <div className="absolute top-2 right-2">
                    <X size={10} className="text-slate-700" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile-Only Pill Buttons */}
      <div className="flex flex-col gap-4 mt-8 sm:hidden px-4">
        <button 
          onClick={() => setShowSubModal(true)}
          className={`flex items-center justify-between gap-4 px-6 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] transition-all border-2 ${
            isSubscribed 
              ? 'bg-aurora-cyan/10 border-aurora-cyan/30 text-aurora-cyan hover:bg-aurora-cyan/20' 
              : 'bg-aurora-rose text-white border-aurora-rose shadow-neon-rose animate-bounce'
          }`}
        >
          <div className="flex items-center gap-3">
            <CreditCard size={18} />
            <span>{isSubscribed ? 'Subscription: Active' : 'Renew Subscription'}</span>
          </div>
          <span className="text-[10px] text-opacity-80">→</span>
        </button>
        <button 
          onClick={() => setShowHowToModal(true)}
          className="flex items-center justify-between gap-4 px-6 py-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 font-black text-[11px] uppercase tracking-[0.25em] hover:bg-amber-500/20"
        >
          <div className="flex items-center gap-3">
            <BookOpen size={18} />
            <span>How to Use EduTrack</span>
          </div>
          <span className="text-[10px] text-amber-500/80">→</span>
        </button>
        <button 
          onClick={() => setShowAboutModal(true)}
          className="flex items-center justify-between gap-4 px-6 py-5 rounded-2xl bg-white/5 border-2 border-white/10 text-slate-300 font-black text-[11px] uppercase tracking-[0.25em] hover:bg-white/10"
        >
          <div className="flex items-center gap-3">
            <Info size={18} />
            <span>About EduTrack UG</span>
          </div>
          <span className="text-[10px] text-slate-500">→</span>
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <InsightCard
          label="Total Students"
          value={`${stats.maleStudents + stats.femaleStudents}`}
          subValue={`M: ${stats.maleStudents} | F: ${stats.femaleStudents}`}
          icon={<Users size={24} />}
          color={isSubscribed ? (isPrimary ? "text-emerald-400" : "text-aurora-cyan") : "text-slate-700"}
          glow={isSubscribed ? (isPrimary ? "shadow-[0_0_30px_rgba(16,185,129,0.3)]" : "shadow-neon-cyan") : ""}
        />
        <InsightCard
          label="Total Teachers"
          value={`${stats.maleTeachers + stats.femaleTeachers}`}
          subValue={`M: ${stats.maleTeachers} | F: ${stats.femaleTeachers}`}
          icon={<UserX size={24} />}
          color={isSubscribed ? (isPrimary ? "text-amber-400" : "text-aurora-amber") : "text-slate-700"}
          glow={isSubscribed ? (isPrimary ? "shadow-[0_0_30px_rgba(245,158,11,0.3)]" : "shadow-neon-amber") : ""}
        />
        <InsightCard
          label="On-Site Today"
          value={`${stats.present} Students`}
          subValue={`${stats.absent} Absentees Flagged`}
          icon={<CheckSquare size={24} />}
          color={isSubscribed ? (isPrimary ? "text-blue-400" : "text-aurora-emerald") : "text-slate-700"}
          glow={isSubscribed ? (isPrimary ? "shadow-[0_0_30px_rgba(59,130,246,0.3)]" : "shadow-neon-emerald") : ""}
        />
        <InsightCard
          label="Instructional Flow"
          value={`${stats.participation}%`}
          subValue="Daily Syllabus Progress"
          icon={<TrendingUp size={24} />}
          color={isSubscribed ? (isPrimary ? "text-emerald-500" : "text-aurora-rose") : "text-slate-700"}
          glow={isSubscribed ? (isPrimary ? "shadow-[0_0_30px_rgba(16,185,129,0.3)]" : "shadow-neon-rose") : ""}
        />
      </div>

      {/* Subscription Modal */}
      {showSubModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 h-dvh w-screen overflow-hidden bg-slate-950/95 backdrop-blur-xl">
          <div className="relative bg-slate-950 w-full h-full sm:h-auto sm:max-w-lg flex flex-col justify-between p-6 sm:p-10 sm:rounded-[2.5rem] sm:border sm:border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500 overflow-hidden">
            
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
              <div className="flex flex-col justify-center relative min-h-[220px] overflow-hidden">
                <div className="relative w-full h-full flex items-center justify-center">
                  {pricingTiers.map((tier, idx) => (
                    <div 
                      key={idx} 
                      className={`absolute inset-0 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 flex flex-col items-start justify-between transition-all duration-1000 ease-in-out
                        ${idx === pricingIndex 
                          ? 'opacity-100 scale-100 blur-none' 
                          : 'opacity-0 scale-95 blur-sm pointer-events-none'}`}
                    >
                      <div className="w-full space-y-4">
                        <div className="flex items-end justify-between w-full">
                          <div className="space-y-1">
                            <p className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em] leading-none">{tier.name}</p>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em] leading-none">Enrollment Range</p>
                            <p className="text-sm font-bold text-slate-200 tracking-wide uppercase">{tier.range}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-cyan-500/50 uppercase tracking-[0.2em] leading-none mb-1">Termly Rate</p>
                            <p className="text-xl font-extrabold text-cyan-400 tracking-tight">{tier.price}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {tier.valueProps.map((prop, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <CheckSquare size={12} className="text-emerald-400 shrink-0" />
                              <p className="text-[10px] text-slate-300">{prop}</p>
                            </div>
                          ))}
                        </div>
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

              {/* Founder Section */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 text-rose-400">
                  <User size={18} />
                  <h4 className="text-sm font-black uppercase tracking-widest">Founder</h4>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-start gap-4">
                    {/* Founder Avatar/Photo Placeholder */}
                    <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                      <User size={36} className="text-white" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-lg font-extrabold text-white tracking-tight">ZZIWA HARUNA</p>
                      <p className="text-xs font-bold text-rose-400 uppercase tracking-widest">Founder & CEO, Modern Systems Tech</p>
                      <p className="text-xs font-medium text-slate-400 leading-relaxed italic">
                        "My mission is to eliminate administrative friction for every Ugandan school—so educators can focus on what matters most: teaching."
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <a href="tel:+256752333216" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all">
                      <Phone size={14} className="text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">0752 333 216</span>
                    </a>
                    <a href="mailto:edutrackug@gmail.com" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all">
                      <Mail size={14} className="text-cyan-400" />
                      <span className="text-xs font-bold text-slate-200">edutrackug@gmail.com</span>
                    </a>
                  </div>
                </div>
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

      {/* How to Use Modal */}
      {showHowToModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 h-dvh w-screen overflow-hidden bg-slate-950/95 backdrop-blur-xl">
          <div className="relative bg-slate-950 w-full h-full sm:h-auto sm:max-w-2xl flex flex-col justify-between p-6 sm:p-10 sm:rounded-[2.5rem] sm:border sm:border-white/10 shadow-2xl animate-in fade-in zoom-in duration-500 overflow-hidden">
            
            {/* Header Section */}
            <div className="text-center space-y-4 pt-4 sm:pt-0">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20 mb-6">
                <BookOpen size={24} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent uppercase">
                How to Use EduTrack
              </h3>
              <p className="text-xs font-semibold tracking-widest text-amber-400 max-w-xs mx-auto text-center uppercase leading-relaxed">
                Quick start guide for administrators
              </p>
            </div>
            
            {/* Scrollable Content Section */}
            <div className="flex-1 my-8 overflow-y-auto no-scrollbar space-y-8 pr-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-amber-400">
                  <Target size={18} />
                  <h4 className="text-sm font-black uppercase tracking-widest">Phase 1: Initial School Setup</h4>
                </div>
                <p className="text-xs font-medium text-slate-400 leading-relaxed text-justify">
                  Before teachers and students can use EduTrack effectively, administrators must first complete the foundational configuration process. Start by navigating through the hub buttons in the following order to ensure proper dependencies are set up correctly. First, configure your academic year and term structure, as all subsequent activities will be tied to these temporal markers.
                </p>
                <p className="text-xs font-medium text-slate-400 leading-relaxed text-justify">
                  Add all your teaching staff via the Teachers module next. When creating teacher accounts, ensure you assign them to their respective subject areas and classes. Accurate teacher data ensures marks entry later in the process. After teachers, create your class structure: Senior 1 through Senior 6, divided appropriately into streams if applicable, and assign a class teachers where necessary. Each class must then have students enrolled, which you can do in bulk or individually via the Students button.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Users size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest">Student Management</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    The Students module is your centralized directory hub for everything related to student lifecycle management. From here, you can add new enrollments, edit student biographical data including parent/guardian contact information, assign students to classes, and manage promotions/demotions as students progress through academic years. You can also view student attendance and marks history from the student profile, which is accessible by clicking any student in the directory.
                  </p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400">
                    <Calendar size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest">Attendance Tracking</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Attendance in EduTrack is managed on a daily, term-basis and class-basis, with teachers marking students as present, absent, or with an excused absence. Daily attendance data syncs instantly across the entire platform, automatically populating real-time in reports and parent portal access. Administrators can generate comprehensive attendance reports to identify patterns of absenteeism early, allowing for proactive interventions with students and parents.
                  </p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-violet-400">
                    <Award size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest">Marks & Assessments</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    The Marks module is where teachers submit assessments, mid-term exams, end-of-term exams, and other assessment types. When entering marks, always select the correct assessment type because this is what will appear on report cards. You can filter marks by student, subject, term, year, and assessment type to view performance. Marks are automatically graded using the official UNEB grading scale (O-Level and A-Level supported natively in the system, with points calculated automatically).
                  </p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <PieChart size={16} />
                    <h5 className="text-[11px] font-black uppercase tracking-widest">Report Cards Generation</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    The Reports module is one of the most powerful features of EduTrack. From here, you can generate professional, beautifully designed report cards for an individual student or an entire class at the click of a button. Reports include student attendance, marks, and class positions, with correct filtering for term, year, and assessment type, ensuring that you only use the intended marks on final reports. You can preview reports directly in your browser before downloading them as PDFs, or download an entire class as a compressed ZIP file for bulk printing and distribution.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-cyan-400">
                  <CheckSquare size={18} />
                  <h4 className="text-sm font-black uppercase tracking-widest">Administrator Pro Tips & Best Practices</h4>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">• Always use a consistent assessment type (typically end-of-term exams for final report cards. This avoids confusion and ensures that only the intended marks are displayed.</p>
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">• Regularly export your data to Excel or PDF to maintain offline backups. This protects against data loss and provides an extra layer of security.</p>
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">• Communicate regularly with parents through the Parent Portal, which allows them to view their childrens’ progress in real-time.</p>
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">• Train your teaching staff on the proper use of the platform, especially assessment types and consistent data entry, to maintain data integrity.</p>
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">• Use the analytics dashboard to identify areas where students are struggling and provide timely interventions early on to support student success.</p>
                </div>
              </div>
            </div>

            {/* Action Button Section */}
            <div className="pt-4 sm:pt-0">
              <button 
                onClick={() => setShowHowToModal(false)}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-amber-500/10 hover:shadow-amber-500/30 active:scale-[0.98] transition-all"
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
