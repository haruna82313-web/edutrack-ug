import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { FileText, Search, UserX, AlertTriangle, Loader2, RefreshCw, Phone, GraduationCap, Calendar, ChevronRight } from 'lucide-react';

const AttendanceReports = () => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRange, setFilterRange] = useState('today');
  const [customDate, setCustomDate] = useState('');

  useEffect(() => {
    fetchReport(filterRange);
  }, []);

  const fetchReport = async (range, date = customDate) => {
    setLoading(true);
    setFilterRange(range);
    if (date) setCustomDate(date);
    
    try {
      let query = supabase
        .from('attendance')
        .select(`
          status,
          created_at,
          students (full_name, parent_phone, classes (name))
        `)
        .eq('status', 'absent');

      if (range === 'custom' && date) {
        // Use a range for the specific day to capture all timestamps on that day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
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

        query = query.gte('created_at', startDate.toISOString());

        if (range === 'yesterday') {
          const endOfYesterday = new Date();
          endOfYesterday.setHours(0, 0, 0, 0);
          query = query.lt('created_at', endOfYesterday.toISOString());
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const grouped = data.reduce((acc, curr) => {
        if (!curr.students) return acc;
        const name = curr.students.full_name;
        if (!acc[name]) {
          acc[name] = { 
            name, 
            class: curr.students.classes?.name || 'Unassigned', 
            phone: curr.students.parent_phone, 
            missedCount: 0 
          };
        }
        acc[name].missedCount += 1;
        return acc;
      }, {});
      setReportData(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching report:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const ranges = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'Last 7 Days' },
    { id: 'month', label: 'Last 30 Days' },
    { id: '3months', label: 'Last 3 Months' },
  ];

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 text-slate-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Intelligence Reports</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm lg:text-base">Real-time analysis of student attendance and engagement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/50 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar max-w-full">
          {ranges.map((range) => (
            <button
              key={range.id}
              onClick={() => {
                setCustomDate('');
                fetchReport(range.id, '');
              }}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                filterRange === range.id && !customDate
                  ? 'bg-primary-600 text-white shadow-glow' 
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
              className={`bg-transparent border-none text-[9px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer ${customDate ? 'text-primary-400' : 'text-slate-500'}`}
              value={customDate}
              onChange={(e) => {
                const date = e.target.value;
                setCustomDate(date);
                if (date) fetchReport('custom', date);
              }}
            />
            {customDate && (
              <button 
                onClick={() => {
                  setCustomDate('');
                  fetchReport('today', '');
                }}
                className="ml-1 text-slate-500 hover:text-white"
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Chronic Absentees Table */}
        <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
          <div className="p-6 lg:p-8 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center border border-rose-500/20 shadow-rose-glow">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-black text-white text-lg tracking-tight">Flagged for Review</h3>
                <p className="text-rose-400 text-[10px] font-bold uppercase tracking-widest">
                  Students with absences ({ranges.find(r => r.id === filterRange)?.label})
                </p>
              </div>
            </div>
            <div className="hidden sm:block px-4 py-1.5 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-rose-glow">
              {reportData.length} Discrepancies
            </div>
          </div>

          {/* Desktop View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Identity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Academic Tier</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Sessions Missed</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">Emergency Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-8 py-20 text-center">
                      <Loader2 className="animate-spin text-primary-400 mx-auto mb-4" size={32} />
                      <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Processing Attendance Matrix...</p>
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-8 py-20 text-center">
                      <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-emerald-glow">
                        <FileText size={32} />
                      </div>
                      <p className="text-emerald-400 font-black uppercase tracking-widest text-xs">Perfect Operations: Zero absences detected.</p>
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, i) => (
                    <tr key={i} className="hover:bg-rose-500/5 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center font-black text-xs border border-rose-500/10 group-hover:bg-rose-600 group-hover:text-white transition-all">
                            {row.name.substring(0, 1).toUpperCase()}
                          </div>
                          <span className="font-black text-slate-200 tracking-tight">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-800 group-hover:border-primary-500/20 transition-all">
                          <GraduationCap size={12} /> {row.class}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-xs font-black shadow-lg ${row.missedCount > 2 ? 'bg-rose-600 text-white shadow-rose-900/40' : 'bg-amber-500/10 text-amber-400 shadow-amber-900/20 border border-amber-500/20'}`}>
                          {row.missedCount}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <a 
                          href={`tel:${row.phone}`}
                          className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-primary-400 transition-colors"
                        >
                          <Phone size={14} className="text-primary-500" /> {row.phone}
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden divide-y divide-slate-800">
            {reportData.map((item) => (
              <div key={item.name} className="p-4 space-y-3 active:bg-slate-800 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border border-rose-500/10">
                      {item.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-slate-100 truncate text-sm leading-none">{item.name}</h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 text-[8px] font-black uppercase tracking-widest border border-slate-800 mt-1.5">
                        {item.class}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-rose-400 font-black text-xs">{item.missedCount}x</span>
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Missed</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                  <a href={`tel:${item.phone}`} className="flex items-center gap-2 text-primary-400 font-bold text-[10px]">
                    <Phone size={12} /> {item.phone}
                  </a>
                  <button className="text-slate-500 hover:text-white transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReports;
