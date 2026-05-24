import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useOnlineStatus } from '../lib/offline';
import { motivationalQuotes } from '../lib/quotes';
import { 
  LayoutDashboard, Users, BookOpen, GraduationCap, 
  LogOut, UserCheck, Calendar, FileText, ListChecks, Grid3X3, FolderOpen, FileSpreadsheet,
  Bell, Search, Menu, X, WifiOff, Zap, ChevronRight, ChevronDown, Lock
} from 'lucide-react';

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [openMenus, setOpenMenus] = useState({});
  const [subscriptionStatus, setSubscriptionStatus] = useState('Active');
  const [pendingParents, setPendingParents] = useState(0);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    let subChannel;
    let parentChannel;

    const checkSubscription = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase.from('users').select('school_id').eq('id', authUser.id).maybeSingle();
          if (profile?.school_id) {
            const { data: schools, error: subError } = await supabase
              .from('schools')
              .select('subscription_status')
              .eq('id', profile.school_id);
            
            if (subError || !schools || schools.length === 0) {
              setSubscriptionStatus('Active');
              return;
            }

            setSubscriptionStatus(schools[0].subscription_status || 'Active');

            // 1. Subscription Real-time
            subChannel = supabase
              .channel(`sidebar-status-${profile.school_id}`)
              .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'schools',
                filter: `id=eq.${profile.school_id}`
              }, (payload) => {
                if (payload.new.subscription_status) setSubscriptionStatus(payload.new.subscription_status);
              })
              .subscribe();

            // 2. Fetch Pending Parents Count
            const fetchPending = async () => {
              const { data, error } = await supabase.rpc('get_pending_parent_count');
              if (!error) setPendingParents(data || 0);
            };
            fetchPending();

            // 3. Parent Requests Real-time
            parentChannel = supabase
              .channel('parent-requests')
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'users',
                filter: `role=eq.parent`
              }, () => fetchPending())
              .subscribe();
          }
        }
      } catch (error) {
        setSubscriptionStatus('Active');
      }
    };
    checkSubscription();

    return () => {
      if (subChannel) supabase.removeChannel(subChannel);
      if (parentChannel) supabase.removeChannel(parentChannel);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % motivationalQuotes.length);
    }, 13000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isSubscribed = subscriptionStatus?.toLowerCase() === 'active';

  const navItems = [
    { to: '/', label: 'Hub', icon: <LayoutDashboard size={20} />, alwaysActive: true },
    { to: '/students', label: 'Students', icon: <Users size={20} /> },
    { to: '/teachers', label: 'Teachers', icon: <UserCheck size={20} /> },
    { to: '/classes', label: 'Classes', icon: <GraduationCap size={20} /> },
    { to: '/subjects', label: 'Subjects', icon: <BookOpen size={20} /> },
    { to: '/lessons', label: 'Lessons', icon: <Calendar size={20} /> },
    { to: '/timetables', label: 'Timetables', icon: <Grid3X3 size={20} /> },
    { to: '/syllabus', label: 'Syllabus', icon: <ListChecks size={20} /> },
    { to: '/reports', label: 'Reports', icon: <FileText size={20} /> },
    { to: '/documents', label: 'Documents', icon: <FolderOpen size={20} /> },
    { to: '/export?format=pdf', label: 'Export PDF', icon: <FileText size={20} /> },
    { to: '/export?format=excel', label: 'Export Excel', icon: <FileSpreadsheet size={20} /> },
  ];

  const renderNavItem = (item, isSidebar = false) => {
    const isActive = location.pathname === item.to;
    const isDisabled = !isSubscribed && !item.alwaysActive;
    
    const content = (
      <div className="flex items-center gap-4">
        <span className={`transition-all duration-300 ${isActive ? 'text-white' : (isDisabled ? 'text-slate-700' : 'text-aurora-cyan')}`}>
          {isDisabled ? <Lock size={isSidebar ? 18 : 16} /> : item.icon}
        </span>
        {item.label}
      </div>
    );

    const commonClasses = isSidebar 
      ? `group flex items-center justify-between px-6 py-4 rounded-2xl text-[11px] sm:text-[12px] font-black uppercase tracking-[0.15em] transition-all duration-300 animate-in slide-in-from-right-10 fade-in break-words`
      : `px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap flex items-center gap-2`;

    const activeClasses = isSidebar
      ? 'bg-gradient-to-r from-aurora-cyan to-aurora-violet text-white shadow-neon-cyan'
      : 'bg-gradient-to-r from-aurora-cyan to-aurora-violet text-white shadow-[0_0_20px_rgba(34,211,238,0.3)]';

    const inactiveClasses = isSidebar
      ? 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/10 border border-transparent'
      : 'text-slate-400 hover:text-white hover:bg-white/5';

    const disabledClasses = isSidebar
      ? 'bg-slate-900/50 text-slate-700 cursor-not-allowed opacity-50'
      : 'text-slate-700 cursor-not-allowed opacity-50';

    if (isDisabled) {
      return (
        <div key={item.label} className={`${commonClasses} ${disabledClasses}`}>
          {content}
        </div>
      );
    }

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => isSidebar && setIsSidebarOpen(false)}
        className={`${commonClasses} ${isActive ? activeClasses : inactiveClasses}`}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-aurora-navy font-sans text-white overflow-x-hidden relative">
      {/* Dynamic Background Blurs */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-aurora-cyan/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-aurora-violet/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        
        {/* Header */}
        <header className="h-24 lg:h-32 bg-white/5 backdrop-blur-2xl px-5 lg:px-12 flex items-center justify-between sticky top-0 z-30 border-b border-white/10">
          <div className="flex flex-col flex-1 min-w-0 mr-4">
            <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-aurora-cyan to-aurora-violet">
              EDU<span className="text-white">TRACK</span>
            </h1>
            <div className="h-auto lg:h-12 mt-1 w-full max-w-[200px] sm:max-w-xl">
              <p 
                key={quoteIndex}
                className="text-[9px] sm:text-xs lg:text-sm font-black text-aurora-cyan/80 italic animate-in slide-in-from-bottom-2 fade-in duration-700 leading-tight animate-aurora break-words"
              >
                "{motivationalQuotes[quoteIndex]}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
            {pendingParents > 0 && (
              <Link 
                to="/admin/parents"
                className="flex items-center gap-2 bg-aurora-violet/10 border border-aurora-violet/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full animate-pulse shadow-neon-violet group hover:bg-aurora-violet/20 transition-all shrink-0"
              >
                <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 bg-aurora-violet rounded-full"></div>
                <span className="text-[7px] sm:text-[9px] font-black text-aurora-violet uppercase tracking-widest">
                  {pendingParents} Request{pendingParents > 1 ? 's' : ''}
                </span>
              </Link>
            )}
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Control Center</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-aurora-cyan animate-pulse shadow-[0_0_10px_#22d3ee]' : 'bg-aurora-rose shadow-[0_0_10px_#f43f5e]'}`}></div>
                  <span className={`text-[9px] font-black tracking-widest ${isOnline ? 'text-aurora-cyan' : 'text-aurora-rose'}`}>
                    {isOnline ? 'LIVE' : 'OFFLINE'}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-12 h-12 lg:w-14 lg:h-14 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl text-white hover:bg-white/10 hover:border-aurora-cyan/50 transition-all shadow-2xl group shrink-0"
            >
              <Menu size={24} className="group-hover:rotate-90 transition-transform duration-500" />
            </button>
          </div>
        </header>

        {/* Horizontal Navigation Tabs (Desktop Only) */}
        <div className="bg-transparent px-6 lg:px-12 py-6 hidden md:block">
          <div className="bg-white/5 backdrop-blur-md p-2 rounded-3xl border border-white/10 inline-flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full shadow-2xl">
            {navItems.map((item) => renderNavItem(item))}
          </div>
        </div>

        {/* Professional Hamburger Menu (Overlay) */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end no-scrollbar">
            <div 
              className="absolute inset-0 bg-aurora-navy/80 backdrop-blur-xl animate-in fade-in duration-500" 
              onClick={() => setIsSidebarOpen(false)}
            ></div>
            <div className="relative w-[75%] sm:w-[50%] md:w-[35%] bg-aurora-navy/95 backdrop-blur-2xl h-full border-l border-white/10 p-8 sm:p-12 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in slide-in-from-right duration-500 ease-out no-scrollbar">
              
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-aurora-cyan to-aurora-violet rounded-2xl flex items-center justify-center shadow-neon-cyan">
                    <Zap size={28} className="text-white" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tighter uppercase">Operations</h2>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)} 
                  className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-aurora-rose/20 transition-all border border-white/10"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
                {navItems.map((item, index) => renderNavItem(item, true))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-aurora-rose/10 border border-aurora-rose/20 text-aurora-rose font-black text-[11px] uppercase tracking-[0.15em] hover:bg-aurora-rose hover:text-white transition-all shadow-neon-rose active:scale-95 duration-200"
                >
                  <LogOut size={18} /> Logout Account
                </button>
                <div className="mt-10 text-center space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">EduTrack Pro • v2.0</p>
                  <p className="text-[9px] text-aurora-cyan/50 font-black tracking-widest lowercase opacity-60">haruna82313@gmail.com</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <main className="flex-1 p-6 lg:p-12 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
