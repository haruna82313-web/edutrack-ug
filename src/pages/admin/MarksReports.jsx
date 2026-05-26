import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Star, Search, Loader2, Calendar, 
  GraduationCap, BookOpen, User, RefreshCw,
  TrendingUp, Award, ChevronRight, Send, CheckCircle2,
  X, Filter, LayoutGrid, List
} from 'lucide-react';

const MarksReports = () => {
  const { user } = useAuth();
  const [marksData, setMarksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRange, setFilterRange] = useState('today');
  const [filterGender, setFilterGender] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'list'
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchMarks(filterRange);
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

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
          students (full_name, gender, classes (name, id)),
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
      showNotification('Failed to access academic database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredMarks = useMemo(() => {
    return marksData.filter(m => {
      const query = searchTerm.toLowerCase();
      const matchesSearch = (
        m.students?.full_name?.toLowerCase().includes(query) ||
        m.subjects?.name?.toLowerCase().includes(query) ||
        m.students?.classes?.name?.toLowerCase().includes(query) ||
        m.users?.full_name?.toLowerCase().includes(query)
      );
      const matchesGender = filterGender === 'all' || m.students?.gender === filterGender;
      return matchesSearch && matchesGender;
    });
  }, [marksData, searchTerm, filterGender]);

  const groupedMarks = useMemo(() => {
    const groups = {};
    filteredMarks.forEach(m => {
      const date = new Date(m.created_at).toDateString();
      const key = `${m.subject_id}-${m.students?.classes?.id}-${m.teacher_id}-${date}`;
      
      if (!groups[key]) {
        groups[key] = {
          id: key,
          subject: m.subjects?.name,
          class: m.students?.classes?.name,
          teacher: m.users?.full_name || 'System',
          timestamp: m.created_at,
          marks: [],
          isPublished: m.is_published,
          avgScore: 0
        };
      }
      groups[key].marks.push(m);
    });

    return Object.values(groups).map(group => {
      const total = group.marks.reduce((acc, m) => acc + parseFloat(m.marks), 0);
      const maxTotal = group.marks.reduce((acc, m) => acc + parseFloat(m.max_marks), 0);
      group.avgScore = Math.round((total / maxTotal) * 100);
      group.isPublished = group.marks.every(m => m.is_published);
      group.marks.sort((a, b) => b.marks - a.marks); // Sort students highest to lowest
      return group;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [filteredMarks]);

  const subjectAverages = useMemo(() => {
    const subjects = {};
    filteredMarks.forEach(m => {
      const name = m.subjects?.name || 'Unknown';
      if (!subjects[name]) {
        subjects[name] = { total: 0, count: 0, max: 0 };
      }
      subjects[name].total += parseFloat(m.marks);
      subjects[name].count += 1;
      subjects[name].max += parseFloat(m.max_marks);
    });

    return Object.entries(subjects).map(([name, data]) => ({
      name,
      average: Math.round((data.total / data.count) * 10) / 10,
      percentage: Math.round((data.total / data.max) * 100),
      count: data.count
    })).sort((a, b) => b.percentage - a.percentage);
  }, [filteredMarks]);

  const handlePushMarks = async (marksToPush = filteredMarks) => {
    const unpublishedMarks = marksToPush.filter(m => !m.is_published);
    if (unpublishedMarks.length === 0) {
      showNotification("Selected records are already published", "info");
      return;
    }

    setIsPushing(true);
    try {
      const idsToUpdate = unpublishedMarks.map(m => m.id);
      
      const { error } = await supabase
        .from('student_marks')
        .update({ is_published: true })
        .in('id', idsToUpdate);

      if (error) throw error;

      showNotification(`Successfully published ${unpublishedMarks.length} records to parents`);
      fetchMarks(filterRange);
      if (selectedGroup) {
        // Refresh selected group data
        const updatedGroup = { ...selectedGroup };
        updatedGroup.marks = updatedGroup.marks.map(m => ({ ...m, is_published: true }));
        updatedGroup.isPublished = true;
        setSelectedGroup(updatedGroup);
      }
    } catch (error) {
      console.error('Error pushing marks:', error.message);
      showNotification("Synchronization failure: " + error.message, "error");
    } finally {
      setIsPushing(false);
    }
  };

  const ranges = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 text-slate-300 relative">
      {/* Notification Banner */}
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl border shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
          notification.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : 
          notification.type === 'info' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' :
          'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
        }`}>
          {notification.type === 'error' ? <X size={18} /> : <CheckCircle2 size={18} />}
          <span className="text-[10px] font-black uppercase tracking-widest">{notification.message}</span>
        </div>
      )}

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
          <div className="h-4 w-[1px] bg-slate-800 mx-1"></div>
          <div className="relative flex items-center px-2">
            <select
              className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest text-slate-500 focus:ring-0 cursor-pointer outline-none"
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
            >
              <option value="all" className="bg-slate-900 text-white">All Genders</option>
              <option value="Male" className="bg-slate-900 text-white">Male</option>
              <option value="Female" className="bg-slate-900 text-white">Female</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group w-full">
          <input
            type="text"
            placeholder="Search by student, class, or subject..."
            className="input-field pl-12 h-14"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-aurora-cyan transition-transform group-focus-within:scale-110" size={20} />
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
          <button 
            onClick={() => setViewMode('grouped')}
            className={`flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'grouped' ? 'bg-aurora-cyan text-aurora-navy shadow-neon-cyan' : 'text-slate-500 hover:bg-slate-800'}`}
          >
            <LayoutGrid size={16} /> Grouped
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`flex-1 md:flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-aurora-cyan text-aurora-navy shadow-neon-cyan' : 'text-slate-500 hover:bg-slate-800'}`}
          >
            <List size={16} /> List
          </button>
        </div>

        <button 
          onClick={() => handlePushMarks()}
          disabled={isPushing || filteredMarks.length === 0}
          className="w-full md:w-auto px-8 h-14 bg-aurora-cyan text-aurora-navy rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-neon-cyan hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
        >
          {isPushing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          {isPushing ? 'Pushing Node...' : 'Push All'}
        </button>
      </div>

      {/* Subject Averages Section */}
      {subjectAverages.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-500">
          {subjectAverages.map((sub, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-aurora-cyan/5 rounded-bl-full pointer-events-none"></div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{sub.name}</p>
              <div className="flex items-end justify-between">
                <div>
                  <h4 className="text-2xl font-black text-white leading-none">{sub.percentage}%</h4>
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Average Score</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-aurora-cyan">{sub.count}</p>
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Records</p>
                </div>
              </div>
              <div className="mt-4 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-aurora-cyan shadow-neon-cyan transition-all duration-1000" 
                  style={{ width: `${sub.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Matrix */}
      {viewMode === 'grouped' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          {loading ? (
            <div className="col-span-full py-20 text-center">
              <Loader2 className="animate-spin text-aurora-cyan mx-auto mb-4" size={32} />
              <p className="text-slate-600 font-black uppercase tracking-widest text-[10px]">Accessing Academic Matrix...</p>
            </div>
          ) : groupedMarks.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                <TrendingUp size={32} className="text-slate-800" />
              </div>
              <p className="text-slate-600 font-black uppercase tracking-widest text-[10px]">No records found for this period.</p>
            </div>
          ) : (
            groupedMarks.map((group) => (
              <div 
                key={group.id} 
                onClick={() => setSelectedGroup(group)}
                className="bg-slate-900/80 border border-slate-800 p-6 rounded-[2rem] hover:border-aurora-cyan/30 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98]"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-aurora-cyan/5 rounded-bl-[3rem] pointer-events-none group-hover:bg-aurora-cyan/10 transition-colors"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-aurora-cyan uppercase tracking-widest bg-aurora-cyan/10 px-2.5 py-1 rounded-full border border-aurora-cyan/20">
                        {group.subject}
                      </span>
                      {group.isPublished ? (
                        <span className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <CheckCircle2 size={10} /> Published
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[8px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <RefreshCw size={10} /> Pending
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-white tracking-tight mt-2">{group.class}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-aurora-cyan leading-none">{group.avgScore}%</p>
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mt-1">Class Avg</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800/50">
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                    <span className="text-slate-500 flex items-center gap-2">
                      <User size={12} className="text-aurora-violet" /> {group.teacher}
                    </span>
                    <span className="text-slate-600">
                      {group.marks.length} Students
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[8px] font-black text-slate-600 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} /> {new Date(group.timestamp).toLocaleDateString()}
                    </span>
                    <span>
                      {new Date(group.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in duration-500">
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

          {/* Desktop Table View */}
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
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-200 tracking-tight">{m.students?.full_name}</span>
                            {m.students?.gender && (
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${m.students.gender === 'Male' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {m.students.gender === 'Male' ? 'M' : 'F'}
                              </span>
                            )}
                          </div>
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
                          <div className="flex items-center gap-2 mb-1">
                            {m.is_published ? (
                              <span className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <CheckCircle2 size={10} /> Published
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[8px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                <RefreshCw size={10} /> Pending
                              </span>
                            )}
                            <span className="text-[10px] font-black text-slate-200 tracking-widest">
                              {new Date(m.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
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
        </div>
      )}

      {/* Group Detail Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[85vh] rounded-[2.5rem] flex flex-col overflow-hidden shadow-neon-cyan animate-in zoom-in duration-300">
            <div className="p-8 border-b border-white/5 bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-aurora-cyan/10 text-aurora-cyan rounded-2xl flex items-center justify-center border border-aurora-cyan/20">
                  <GraduationCap size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">{selectedGroup.class}</h3>
                  <p className="text-[9px] font-black text-aurora-cyan uppercase tracking-widest mt-1">
                    {selectedGroup.subject} • {selectedGroup.teacher}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedGroup(null)}
                className="w-10 h-10 bg-white/5 text-slate-500 hover:text-white rounded-xl flex items-center justify-center transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 no-scrollbar space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Student Performance (Highest to Lowest)</p>
                <div className="text-right">
                  <p className="text-2xl font-black text-aurora-cyan leading-none">{selectedGroup.avgScore}%</p>
                  <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Class Average</p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedGroup.marks.map((m, i) => (
                  <div key={m.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between group hover:border-aurora-cyan/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-slate-500 font-black text-xs">
                        {i + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-100">{m.students?.full_name}</p>
                          {m.students?.gender && (
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${m.students.gender === 'Male' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {m.students.gender === 'Male' ? 'M' : 'F'}
                            </span>
                          )}
                        </div>
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-0.5">Academic Record • {new Date(m.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${m.marks >= 70 ? 'text-emerald-400' : m.marks >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {m.marks}
                      </p>
                      <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">/ {m.max_marks}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-slate-950/50 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedGroup.isPublished ? (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <CheckCircle2 size={16} />
                    <span className="text-[9px] font-black uppercase tracking-widest">Successfully Published</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-500">
                    <RefreshCw size={16} className="animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Pending Synchronization</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => handlePushMarks(selectedGroup.marks)}
                disabled={isPushing || selectedGroup.isPublished}
                className="bg-aurora-cyan text-aurora-navy px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-neon-cyan disabled:opacity-50 disabled:shadow-none hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                {isPushing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                {selectedGroup.isPublished ? 'Already Published' : 'Push This Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarksReports;
