import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Star, Search, Loader2, Calendar, 
  GraduationCap, BookOpen, User, RefreshCw,
  TrendingUp, Award, ChevronRight
} from 'lucide-react';

const MarksReports = () => {
  const { user } = useAuth();
  const [marksData, setMarksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRange, setFilterRange] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMarks(filterRange);
  }, []);

  const fetchMarks = async (range, date = customDate) => {
    setLoading(true);
    setFilterRange(range);
    if (date) setCustomDate(date);
    
    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      const sid = profile?.school_id;

      let query = supabase
        .from('student_marks')
        .select(`
          *,
          students (full_name, classes (name)),
          subjects (name),
          users!student_marks_teacher_id_fkey (full_name)
        `)
        .order('created_at', { ascending: false });

      if (sid) query = query.eq('school_id', sid);

      if (range === 'custom' && date) {
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
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
        }

        if (range !== 'all') {
          query = query.gte('created_at', startDate.toISOString());
          if (range === 'yesterday') {
            const endOfYesterday = new Date();
            endOfYesterday.setHours(0, 0, 0, 0);
            query = query.lt('created_at', endOfYesterday.toISOString());
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setMarksData(data || []);
    } catch (error) {
      console.error('Error fetching marks:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMarks = marksData.filter(m => {
    const query = searchTerm.toLowerCase();
    return (
      m.students?.full_name?.toLowerCase().includes(query) ||
      m.subjects?.name?.toLowerCase().includes(query) ||
      m.students?.classes?.name?.toLowerCase().includes(query) ||
      m.users?.full_name?.toLowerCase().includes(query)
    );
  });

  const ranges = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 text-slate-300">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight uppercase">Academic Performance Ledger</h2>
          <p className="text-slate-500 mt-1 font-black text-[10px] sm:text-xs uppercase tracking-widest">
            Track and audit academic submissions across the institution.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/50 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar max-w-full">
          {ranges.map((range) => (
            <button
              key={range.id}
              onClick={() => {
                setCustomDate('');
                fetchMarks(range.id, '');
              }}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filterRange === range.id && !customDate
                  ? 'bg-aurora-cyan text-aurora-navy shadow-neon-cyan' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {range.label}
            </button>
          ))}
          <div className="h-4 w-[1px] bg-slate-800 mx-1"></div>
          <div className="relative flex items-center px-2">
            <input
              type="date"
              className={`bg-transparent border-none text-[9px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer ${customDate ? 'text-aurora-cyan' : 'text-slate-500'}`}
              value={customDate}
              onChange={(e) => {
                const date = e.target.value;
                setCustomDate(date);
                if (date) fetchMarks('custom', date);
              }}
            />
            {customDate && (
              <button 
                onClick={() => {
                  setCustomDate('');
                  fetchMarks('today', '');
                }}
                className="ml-1 text-slate-500 hover:text-white"
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md group">
        <input
          type="text"
          placeholder="Search by student, class, or subject..."
          className="input-field pl-12 h-14"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-aurora-cyan transition-transform group-focus-within:scale-110" size={20} />
      </div>

      {/* Results Matrix */}
      <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-800 bg-slate-950/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-aurora-cyan/10 text-aurora-cyan rounded-2xl flex items-center justify-center border border-aurora-cyan/20 shadow-neon-cyan">
              <Award size={24} />
            </div>
            <div>
              <h3 className="font-black text-white text-lg tracking-tight uppercase">Submission Feed</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">
                {filteredMarks.length} records detected in selected timeframe
              </p>
            </div>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student & Class</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Subject</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Score</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Instructor</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <Loader2 className="animate-spin text-aurora-cyan mx-auto mb-4" size={32} />
                    <p className="text-slate-600 font-black uppercase tracking-widest text-[10px]">Accessing Performance Matrix...</p>
                  </td>
                </tr>
              ) : filteredMarks.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                      <TrendingUp size={32} className="text-slate-800" />
                    </div>
                    <p className="text-slate-600 font-black uppercase tracking-widest text-[10px]">No academic records found for this period.</p>
                  </td>
                </tr>
              ) : (
                filteredMarks.map((m, i) => (
                  <tr key={m.id} className="hover:bg-aurora-cyan/5 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-200 tracking-tight">{m.students?.full_name}</span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                          <GraduationCap size={10} /> {m.students?.classes?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 text-aurora-cyan text-[10px] font-black uppercase tracking-widest border border-aurora-cyan/20">
                        <BookOpen size={12} /> {m.subjects?.name}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-lg font-black ${m.marks >= 70 ? 'text-emerald-400' : m.marks >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {m.marks}
                        </span>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">/ {m.max_marks}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <User size={12} className="text-aurora-violet" /> {m.users?.full_name || 'System'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-200 tracking-widest">
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden divide-y divide-slate-800">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="animate-spin text-aurora-cyan mx-auto" size={24} />
            </div>
          ) : filteredMarks.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-600 font-black uppercase tracking-widest text-[9px]">No records found.</p>
            </div>
          ) : (
            filteredMarks.map((m) => (
              <div key={m.id} className="p-5 space-y-4 active:bg-slate-800 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-slate-100 text-sm truncate">{m.students?.full_name}</h4>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                      {m.students?.classes?.name} • {m.subjects?.name}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <span className={`text-lg font-black ${m.marks >= 70 ? 'text-emerald-400' : m.marks >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {m.marks}
                    </span>
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Score</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                  <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    <User size={12} /> {m.users?.full_name?.split(' ')[0]}
                  </div>
                  <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    {new Date(m.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MarksReports;
