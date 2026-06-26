import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, BookOpen, CheckCircle2, Loader2 } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export const StudentSubjectsModal = ({ student, isOpen, onClose, schoolId }) => {
  const { showNotification } = useNotification();
  const [subjects, setSubjects] = useState([]);
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    if (isOpen && student) {
      fetchData();
    }
  }, [isOpen, student, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all subjects for the school
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('school_id', schoolId)
        .order('name');
      setSubjects(subjectsData || []);

      // Fetch already assigned subjects for this student
      const { data: assignedData } = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', student.id)
        .eq('school_id', schoolId)
        .eq('academic_year', selectedYear);
      
      setAssignedSubjects(assignedData?.map(a => a.subject_id) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = async (subjectId) => {
    const isAssigned = assignedSubjects.includes(subjectId);
    
    if (isAssigned) {
      // Remove assignment
      await supabase
        .from('student_subjects')
        .delete()
        .eq('student_id', student.id)
        .eq('subject_id', subjectId)
        .eq('school_id', schoolId)
        .eq('academic_year', selectedYear);
      setAssignedSubjects(prev => prev.filter(id => id !== subjectId));
    } else {
      // Add assignment
      await supabase
        .from('student_subjects')
        .insert({
          student_id: student.id,
          subject_id: subjectId,
          school_id: schoolId,
          academic_year: selectedYear
        });
      setAssignedSubjects(prev => [...prev, subjectId]);
    }
  };

  const assignAll = async () => {
    setSaving(true);
    try {
      const assignments = subjects.map(subject => ({
        student_id: student.id,
        subject_id: subject.id,
        school_id: schoolId,
        academic_year: selectedYear
      }));
      
      await supabase.from('student_subjects').insert(assignments, { onConflict: 'student_id, subject_id, school_id, academic_year' });
      setAssignedSubjects(subjects.map(s => s.id));
    } catch (error) {
      console.error('Error assigning all subjects:', error);
    } finally {
      setSaving(false);
    }
  };

  const removeAll = async () => {
    setSaving(true);
    try {
      await supabase
        .from('student_subjects')
        .delete()
        .eq('student_id', student.id)
        .eq('school_id', schoolId)
        .eq('academic_year', selectedYear);
      setAssignedSubjects([]);
    } catch (error) {
      console.error('Error removing all subjects:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Manage Subjects</h3>
            <p className="text-slate-400 text-sm font-medium mt-1">
              Select subjects for {student.full_name}
              {student.classes?.name && (
                <span className="ml-2 px-2 py-0.5 bg-primary-600/20 text-primary-400 rounded-full text-[10px] font-bold uppercase">
                  {student.classes.name}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-4 mb-4">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Academic Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            {[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - 2 + i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>

        {/* Bulk actions */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={assignAll}
            disabled={saving || loading}
            className="flex-1 py-2 px-4 bg-primary-600/20 text-primary-400 border border-primary-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null}
            Assign All
          </button>
          <button
            onClick={removeAll}
            disabled={saving || loading}
            className="flex-1 py-2 px-4 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin inline mr-2" /> : null}
            Remove All
          </button>
        </div>

        {/* Subjects grid */}
        <div className="overflow-y-auto flex-1 pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary-400" size={32} />
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="mx-auto text-slate-600 mb-3" size={32} />
              <p className="text-slate-500 font-bold text-sm">No subjects created yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subjects.map((subject) => {
                const isAssigned = assignedSubjects.includes(subject.id);
                return (
                  <button
                    key={subject.id}
                    onClick={() => toggleSubject(subject.id)}
                    disabled={saving}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 active:scale-[0.98] disabled:opacity-50 ${
                      isAssigned
                        ? 'border-primary-500 bg-primary-600/10 shadow-primary-500/20'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isAssigned ? 'bg-primary-600' : 'bg-slate-700'
                        }`}>
                          {isAssigned ? (
                            <CheckCircle2 size={16} className="text-white" />
                          ) : (
                            <BookOpen size={16} className="text-slate-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-black text-white text-sm tracking-tight">
                            {subject.name}
                          </h4>
                          {subject.code && (
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                              {subject.code}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {assignedSubjects.length} of {subjects.length} subjects assigned
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
