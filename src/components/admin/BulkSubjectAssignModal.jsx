import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, BookOpen, CheckCircle2, Loader2, Users } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export const BulkSubjectAssignModal = ({ classInfo, isOpen, onClose, schoolId }) => {
  const { showNotification } = useNotification();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [mode, setMode] = useState('add'); // 'add' or 'replace'

  useEffect(() => {
    if (isOpen && classInfo) {
      fetchData();
    }
  }, [isOpen, classInfo, selectedYear]);

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

      // Fetch active students in the class
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classInfo.id)
        .eq('status', 'active')
        .order('full_name');
      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subjectId) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId) 
        : [...prev, subjectId]
    );
  };

  const selectAll = () => {
    setSelectedSubjects(subjects.map(s => s.id));
  };

  const clearAll = () => {
    setSelectedSubjects([]);
  };

  const applyBulkAssign = async () => {
    if (selectedSubjects.length === 0 || students.length === 0) return;
    
    setSaving(true);
    try {
      if (mode === 'replace') {
        // First remove all existing assignments for these students in this year
        const studentIds = students.map(s => s.id);
        await supabase
          .from('student_subjects')
          .delete()
          .in('student_id', studentIds)
          .eq('school_id', schoolId)
          .eq('academic_year', selectedYear);
      }

      // Create assignments for all selected subjects and students
      const assignments = [];
      students.forEach(student => {
        selectedSubjects.forEach(subjectId => {
          assignments.push({
            student_id: student.id,
            subject_id: subjectId,
            school_id: schoolId,
            academic_year: selectedYear
          });
        });
      });

      // Insert with onConflict to avoid duplicates
      await supabase.from('student_subjects').insert(assignments, { 
        onConflict: 'student_id, subject_id, school_id, academic_year' 
      });

      showNotification(`Successfully assigned ${selectedSubjects.length} subjects to ${students.length} students!`, 'success');
      onClose();
    } catch (error) {
      console.error('Error bulk assigning subjects:', error);
      showNotification('Failed to assign subjects. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };



  if (!isOpen || !classInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Bulk Assign Subjects</h3>
            <p className="text-slate-400 text-sm font-medium mt-1 flex items-center gap-2">
              <Users size={16} />
              {classInfo.name} • {students.length} students
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Year selector */}
          <div className="flex items-center gap-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Academic Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>

          {/* Mode selector */}
          <div className="flex items-center gap-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="add">Add to existing</option>
              <option value="replace">Replace all</option>
            </select>
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={selectAll}
            disabled={saving || loading}
            className="flex-1 py-2 px-4 bg-primary-600/20 text-primary-400 border border-primary-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600/30 transition-all disabled:opacity-50"
          >
            Select All Subjects
          </button>
          <button
            onClick={clearAll}
            disabled={saving || loading}
            className="flex-1 py-2 px-4 bg-slate-700/20 text-slate-400 border border-slate-600/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700/30 transition-all disabled:opacity-50"
          >
            Clear Selection
          </button>
        </div>

        {/* Mode explanation */}
        <div className={`p-3 rounded-xl mb-4 text-[11px] font-medium ${
          mode === 'replace' 
            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          {mode === 'replace' 
            ? '⚠️ Replace mode: This will REMOVE ALL existing subject assignments for these students and replace them with your selection.'
            : '✓ Add mode: This will add your selected subjects to existing assignments without removing anything.'
          }
        </div>

        {/* Subjects grid */}
        <div className="overflow-y-auto flex-1 pr-2 mb-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjects.map((subject) => {
                const isSelected = selectedSubjects.includes(subject.id);
                return (
                  <button
                    key={subject.id}
                    onClick={() => toggleSubject(subject.id)}
                    disabled={saving}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 active:scale-[0.98] disabled:opacity-50 ${
                      isSelected
                        ? 'border-primary-500 bg-primary-600/10 shadow-primary-500/20'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-primary-600' : 'bg-slate-700'
                        }`}>
                          {isSelected ? (
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
            {selectedSubjects.length} of {subjects.length} subjects selected • {students.length} students
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={applyBulkAssign}
              disabled={saving || loading || selectedSubjects.length === 0}
              className="px-6 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-500 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Apply to {students.length} Students
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
