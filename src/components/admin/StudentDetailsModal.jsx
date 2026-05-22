import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  X, Phone, GraduationCap, Star, ShieldCheck, 
  Target, TrendingUp, Calendar, BookOpen, Loader2, MessageSquare
} from 'lucide-react';

const StudentDetailsModal = ({ student, onClose, open }) => {
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [stats, setStats] = useState({
    marks: [],
    attendanceRate: 0,
    absentCount: 0,
    totalSessions: 0
  });

  useEffect(() => {
    if (open && student) {
      fetchStudentStats(filterDate);
    }
  }, [open, student, filterDate]);

  const fetchStudentStats = async (date = filterDate) => {
    try {
      setLoading(true);
      
      // 1. Fetch Marks
      let marksQuery = supabase
        .from('student_marks')
        .select('*, subjects(name)')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      if (date) {
        marksQuery = marksQuery.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
      }

      const { data: marksData } = await marksQuery;

      // 2. Fetch Attendance
      let attQuery = supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id);
      
      if (date) {
        attQuery = attQuery.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
      }

      const { data: attData } = await attQuery;

      const totalSessions = attData?.length || 0;
      const absentCount = attData?.filter(a => a.status === 'absent').length || 0;
      const attendanceRate = totalSessions > 0 
        ? Math.round(((totalSessions - absentCount) / totalSessions) * 100) 
        : 100;

      setStats({
        marks: marksData || [],
        attendanceRate,
        absentCount,
        totalSessions
      });
    } catch (error) {
      console.error('Error fetching student stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-aurora-navy/95 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative glass-card w-full max-w-2xl p-5 lg:p-10 space-y-6 lg:space-y-8 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl lg:rounded-[2.5rem]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div className="flex items-center gap-4 lg:gap-5">
            <div className={`w-14 h-14 lg:w-20 lg:h-20 rounded-2xl lg:rounded-3xl flex items-center justify-center font-black text-xl lg:text-3xl border shadow-glow shrink-0 ${
              student.leadership_role ? 'bg-aurora-amber/20 text-aurora-amber border-aurora-amber/20' : 'bg-primary-600/10 text-primary-400 border-primary-500/10'
            }`}>
              {student.leadership_role ? <Star size={24} lg:size={32} /> : student.full_name.substring(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl lg:text-3xl font-black text-white tracking-tight truncate leading-tight">{student.full_name}</h2>
              <div className="flex flex-wrap items-center gap-2 lg:gap-3 mt-1">
                <span className="inline-flex items-center gap-1.5 text-slate-400 font-black text-[8px] lg:text-xs uppercase tracking-widest">
                  <GraduationCap size={12} lg:size={14} className="text-primary-400 shrink-0" /> {student.classes?.name || 'Unassigned'}
                </span>
                {student.leadership_role && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aurora-amber/10 text-aurora-amber text-[8px] lg:text-[9px] font-black uppercase tracking-widest border border-aurora-amber/20 shadow-neon-amber">
                    <ShieldCheck size={10} lg:size={12} /> {student.leadership_role.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="relative flex items-center bg-white/5 px-3 py-2 rounded-xl border border-white/10">
              <input
                type="date"
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-300 focus:ring-0 cursor-pointer p-0"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              {filterDate && (
                <button onClick={() => setFilterDate('')} className="ml-2 text-slate-500 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
            <button onClick={onClose} className="p-2 lg:p-3 text-slate-500 hover:text-white rounded-xl lg:rounded-2xl hover:bg-white/10 transition-all shrink-0">
              <X size={20} lg:size={24} />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <div className="bg-white/5 border border-white/10 p-4 lg:p-5 rounded-2xl lg:rounded-3xl shadow-xl flex items-center gap-3 lg:gap-4">
            <div className="w-9 h-9 lg:w-12 lg:h-12 bg-aurora-cyan/10 text-aurora-cyan rounded-xl lg:rounded-2xl flex items-center justify-center border border-aurora-cyan/20 shrink-0">
              <TrendingUp size={18} lg:size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Attendance</p>
              <p className="text-base lg:text-xl font-black text-white">{stats.attendanceRate}%</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 lg:p-5 rounded-2xl lg:rounded-3xl shadow-xl flex items-center gap-3 lg:gap-4">
            <div className="w-9 h-9 lg:w-12 lg:h-12 bg-aurora-violet/10 text-aurora-violet rounded-xl lg:rounded-2xl flex items-center justify-center border border-aurora-violet/20 shrink-0">
              <Target size={18} lg:size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Performance</p>
              <p className="text-base lg:text-xl font-black text-white">
                {stats.marks.length > 0 
                  ? Math.round(stats.marks.reduce((acc, m) => acc + (m.marks / m.max_marks), 0) / stats.marks.length * 100) 
                  : '--'}%
              </p>
            </div>
          </div>
        </div>

        {/* Content Tabs (Simplified to one view) */}
        <div className="space-y-6">
          {/* Contact Section */}
          <div className="space-y-3">
            <h3 className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <Phone size={12} lg:size={14} className="text-primary-400 shrink-0" /> Guardian Hub
            </h3>
            <a 
              href={`tel:${student.parent_phone}`}
              className="block bg-slate-900 border border-slate-800 p-4 lg:p-5 rounded-2xl lg:rounded-3xl hover:border-primary-500/50 hover:bg-primary-600/5 transition-all group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Emergency Line</p>
                  <p className="text-base lg:text-lg font-black text-white group-hover:text-primary-400 transition-colors truncate">{student.parent_phone}</p>
                </div>
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary-600/10 text-primary-400 rounded-xl lg:rounded-2xl flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-glow transition-all shrink-0">
                  <Phone size={18} lg:size={20} />
                </div>
              </div>
            </a>
          </div>

          {/* Academic Performance */}
          <div className="space-y-4">
            <h3 className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <BookOpen size={12} lg:size={14} className="text-aurora-violet shrink-0" /> Performance Matrix
            </h3>
            {loading ? (
              <div className="py-10 text-center">
                <Loader2 className="animate-spin text-primary-400 mx-auto" />
              </div>
            ) : stats.marks.length === 0 ? (
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl lg:rounded-3xl text-center border-dashed">
                <p className="text-slate-500 font-black uppercase tracking-widest text-[9px] lg:text-[10px]">No records found for Term 1, 2026.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
                {stats.marks.map((mark, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-3 lg:p-4 rounded-xl lg:rounded-2xl flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">{mark.subjects?.name}</p>
                      <p className="text-xs lg:text-sm font-black text-white">{mark.term}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base lg:text-lg font-black text-aurora-cyan">{mark.marks}<span className="text-[10px] text-slate-500">/{mark.max_marks}</span></p>
                      <p className="text-[8px] lg:text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                        {Math.round((mark.marks / mark.max_marks) * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Comments (Placeholder) */}
          <div className="space-y-3">
            <h3 className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <MessageSquare size={12} lg:size={14} className="text-aurora-rose shrink-0" /> Behavioral Analysis
            </h3>
            <div className="bg-white/5 border border-white/10 p-4 lg:p-5 rounded-2xl lg:rounded-3xl italic text-slate-400 text-[11px] lg:text-sm leading-relaxed">
              "Demonstrates strong leadership and active class participation. Consistent growth in sciences."
              <p className="not-italic text-[8px] lg:text-[9px] font-black text-aurora-rose uppercase tracking-widest mt-3 lg:mt-4">— Faculty Review</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
          <button 
            className="flex-1 btn-primary py-3.5 lg:py-4 text-[9px] lg:text-[10px] font-black uppercase tracking-widest shadow-glow"
            onClick={() => window.open(`/export?format=pdf&studentId=${student.id}`, '_blank')}
          >
            Generate Report Card
          </button>
          <button 
            className="flex-1 sm:flex-none px-6 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl border border-white/10 text-slate-400 text-[9px] lg:text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors"
            onClick={onClose}
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailsModal;
