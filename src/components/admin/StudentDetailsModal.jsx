import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  X, Phone, GraduationCap, Star, ShieldCheck, 
  Target, TrendingUp, Calendar, BookOpen, Loader2, MessageSquare, ChevronDown, ChevronUp, Check, Plus
} from 'lucide-react';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const StudentDetailsModal = ({ student, onClose, open }) => {
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState({});
  const [academicHistory, setAcademicHistory] = useState({});
  const [allSubjects, setAllSubjects] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(new Date().getFullYear().toString());
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  useEffect(() => {
    if (open && student) {
      fetchStudentStats();
      fetchSubjects();
    }
  }, [open, student]);

  const fetchSubjects = async () => {
    try {
      setSubjectsLoading(true);
      const { data: prof } = await supabase.from('users').select('school_id').eq('id', (await supabase.auth.getUser()).data.user.id).single();
      const [subjectsRes, assignmentsRes] = await Promise.all([
        supabase.from('subjects').select('*').eq('school_id', prof.school_id).order('name'),
        supabase.from('student_subjects').select('*').eq('student_id', student.id).eq('school_id', prof.school_id).eq('academic_year', selectedAcademicYear)
      ]);

      setAllSubjects(subjectsRes.data || []);
      setAssignedSubjects(assignmentsRes.data || []);
    } catch (err) {
      console.error('Error fetching subjects:', err);
    } finally {
      setSubjectsLoading(false);
    }
  };

  const toggleSubjectAssignment = async (subjectId) => {
    try {
      setSubjectsLoading(true);
      const { data: prof } = await supabase.from('users').select('school_id').eq('id', (await supabase.auth.getUser()).data.user.id).single();
      const isAssigned = assignedSubjects.some(s => s.subject_id === subjectId);

      if (isAssigned) {
        await supabase.from('student_subjects').delete().eq('student_id', student.id).eq('subject_id', subjectId).eq('school_id', prof.school_id).eq('academic_year', selectedAcademicYear);
        setAssignedSubjects(prev => prev.filter(s => s.subject_id !== subjectId));
      } else {
        const { data: newAssignment } = await supabase.from('student_subjects').insert({
          student_id: student.id,
          subject_id: subjectId,
          school_id: prof.school_id,
          academic_year: selectedAcademicYear
        }).select();
        if (newAssignment) {
          setAssignedSubjects(prev => [...prev, ...newAssignment]);
        }
      }
    } catch (err) {
      console.error('Error toggling subject assignment:', err);
    } finally {
      setSubjectsLoading(false);
    }
  };

  const fetchStudentStats = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch All Marks with subject, class, year, term
      const { data: marksData } = await supabase
        .from('student_marks')
        .select('*, subjects(name), classes(name)')
        .eq('student_id', student.id)
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });

      // 2. Organize marks by year and term
      const history = {};
      
      (marksData || []).forEach(mark => {
        const year = mark.year;
        const term = mark.term;
        
        if (!history[year]) {
          history[year] = {};
        }
        
        if (!history[year][term]) {
          history[year][term] = {
            marks: [],
            classNames: new Set()
          };
        }
        
        history[year][term].marks.push(mark);
        
        if (mark.classes?.name) {
          history[year][term].classNames.add(mark.classes.name);
        }
      });

      setAcademicHistory(history);
      
      // Auto-expand the latest year
      const years = Object.keys(history).sort((a, b) => b - a);
      if (years.length > 0) {
        setExpandedYears({ [years[0]]: true });
      }
    } catch (error) {
      console.error('Error fetching student stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleYear = (year) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  if (!open) return null;

  const sortedYears = Object.keys(academicHistory).sort((a, b) => b - a);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-aurora-navy/95 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative glass-card w-full max-w-4xl p-5 lg:p-10 space-y-6 lg:space-y-8 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl lg:rounded-[2.5rem]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div className="flex items-center gap-4 lg:gap-5">
            <div className={`w-14 h-14 lg:w-20 lg:h-20 rounded-2xl lg:rounded-3xl flex items-center justify-center font-black text-xl lg:text-3xl border shadow-glow shrink-0 ${
              student.leadership_role ? 'bg-aurora-amber/20 text-aurora-amber border-aurora-amber/20' : 'bg-primary-600/10 text-primary-400 border-primary-500/10'
            }`}>
              {student.leadership_role ? <Star size={24} /> : student.full_name.substring(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl lg:text-3xl font-black text-white tracking-tight truncate leading-tight">{student.full_name}</h2>
              <div className="flex flex-wrap items-center gap-2 lg:gap-3 mt-1">
                <span className="inline-flex items-center gap-1.5 text-slate-400 font-black text-[8px] lg:text-xs uppercase tracking-widest">
                  <GraduationCap size={12} className="text-primary-400 shrink-0" /> {student.classes?.name || 'Unassigned'}
                </span>
                {student.leadership_role && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-aurora-amber/10 text-aurora-amber text-[8px] lg:text-[9px] font-black uppercase tracking-widest border border-aurora-amber/20 shadow-neon-amber">
                    <ShieldCheck size={10} /> {student.leadership_role.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 lg:p-3 text-slate-500 hover:text-white rounded-xl lg:rounded-2xl hover:bg-white/10 transition-all shrink-0">
            <X size={20} lg:size={24} />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <div className="bg-white/5 border border-white/10 p-4 lg:p-5 rounded-2xl lg:rounded-3xl shadow-xl flex items-center gap-3 lg:gap-4">
            <div className="w-9 h-9 lg:w-12 lg:h-12 bg-aurora-cyan/10 text-aurora-cyan rounded-xl lg:rounded-2xl flex items-center justify-center border border-aurora-cyan/20 shrink-0">
              <TrendingUp size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Years at School</p>
              <p className="text-base lg:text-xl font-black text-white">{sortedYears.length}</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4 lg:p-5 rounded-2xl lg:rounded-3xl shadow-xl flex items-center gap-3 lg:gap-4">
            <div className="w-9 h-9 lg:w-12 lg:h-12 bg-aurora-violet/10 text-aurora-violet rounded-xl lg:rounded-2xl flex items-center justify-center border border-aurora-violet/20 shrink-0">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Total Assessments</p>
              <p className="text-base lg:text-xl font-black text-white">
                {Object.values(academicHistory).reduce((acc, year) => 
                  acc + Object.values(year).reduce((termAcc, term) => termAcc + term.marks.length, 0), 0
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Contact Section */}
          <div className="space-y-3">
            <h3 className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <Phone size={12} className="text-primary-400 shrink-0" /> Guardian Hub
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
                  <Phone size={18} />
                </div>
              </div>
            </a>
          </div>

          {/* Academic History (Organized by Year & Term) */}
          <div className="space-y-4">
            <h3 className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <BookOpen size={12} className="text-aurora-violet shrink-0" /> Complete Academic History
            </h3>
            {loading ? (
              <div className="py-10 text-center">
                <Loader2 className="animate-spin text-primary-400 mx-auto" />
              </div>
            ) : sortedYears.length === 0 ? (
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl lg:rounded-3xl text-center border-dashed">
                <p className="text-slate-500 font-black uppercase tracking-widest text-[9px] lg:text-[10px]">No academic records found yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedYears.map(year => (
                  <div key={year} className="bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl overflow-hidden">
                    <button 
                      onClick={() => toggleYear(year)}
                      className="w-full flex items-center justify-between px-4 lg:px-6 py-4 lg:py-5 hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-aurora-violet/10 text-aurora-violet rounded-xl flex items-center justify-center border border-aurora-violet/20 shrink-0">
                          <Calendar size={18} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm lg:text-base font-black text-white">{year} Academic Year</p>
                          <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {Object.keys(academicHistory[year]).length} Term{Object.keys(academicHistory[year]).length !== 1 ? 's' : ''} Recorded
                          </p>
                        </div>
                      </div>
                      {expandedYears[year] ? 
                        <ChevronUp size={18} className="text-slate-400" /> : 
                        <ChevronDown size={18} className="text-slate-400" />
                      }
                    </button>
                    
                    {expandedYears[year] && (
                      <div className="px-4 lg:px-6 pb-4 lg:pb-6 border-t border-white/10 space-y-4">
                        {TERMS.map(term => {
                          const termData = academicHistory[year][term];
                          if (!termData || termData.marks.length === 0) return null;
                          
                          return (
                            <div key={term} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[9px] lg:text-[10px] font-black text-aurora-cyan uppercase tracking-widest flex items-center gap-2">
                                  {term}
                                  {termData.classNames.size > 0 && (
                                    <span className="text-slate-500">• {Array.from(termData.classNames).join(', ')}</span>
                                  )}
                                </p>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                  {termData.marks.length} Assessment{termData.marks.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
                                {termData.marks.map((mark, i) => (
                                  <div key={i} className="bg-slate-900 border border-slate-800 p-3 lg:p-4 rounded-xl flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                      <p className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">{mark.subjects?.name}</p>
                                      <p className="text-xs lg:text-sm font-black text-slate-200">{mark.assessment_type}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-base lg:text-lg font-black text-aurora-cyan">{mark.marks}<span className="text-[10px] text-slate-500">/{mark.max_marks}</span></p>
                                      <p className={`text-[8px] lg:text-[9px] font-black uppercase tracking-widest ${
                                        (mark.marks / mark.max_marks) >= 0.7 ? 'text-emerald-400' : 
                                        (mark.marks / mark.max_marks) >= 0.5 ? 'text-amber-400' : 'text-rose-400'
                                      }`}>
                                        {Math.round((mark.marks / mark.max_marks) * 100)}%
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
