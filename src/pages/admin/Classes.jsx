import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, GraduationCap, Loader2, LayoutGrid, Calendar as CalendarIcon, ArrowRight, Search, Users, BookOpen } from 'lucide-react';
import EditModal from '../../components/admin/EditModal';
import RowActions from '../../components/admin/RowActions';
import { deleteClassCascade } from '../../lib/adminCrud';
import { BulkSubjectAssignModal } from '../../components/admin/BulkSubjectAssignModal';

import { useNotification } from '../../context/NotificationContext';

const Classes = () => {
  const { user, profile } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedClassForBulk, setSelectedClassForBulk] = useState(null);
  const [schoolId, setSchoolId] = useState(null);

  const schoolType = profile?.schools?.type || 'secondary';
  const placeholder = schoolType === 'primary' ? 'e.g. Primary 5 East' : 'e.g. Senior 4 West';

  const filteredClasses = classes.filter(cls => 
    cls.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to get only enrolled students (active or suspended)
  const getEnrolledStudents = (students) => 
    students?.filter(s => s.status === 'active' || s.status === 'suspended') || [];

  const totalFilteredStudents = filteredClasses.reduce((acc, cls) => acc + getEnrolledStudents(cls.students).length, 0);
  const totalFilteredMales = filteredClasses.reduce((acc, cls) => acc + getEnrolledStudents(cls.students).filter(s => s.gender === 'Male').length, 0);
  const totalFilteredFemales = filteredClasses.reduce((acc, cls) => acc + getEnrolledStudents(cls.students).filter(s => s.gender === 'Female').length, 0);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();
      
      setSchoolId(profile?.school_id);

      const { data, error } = await supabase
        .from('classes')
        .select('*, students(gender, status)')
        .eq('school_id', profile?.school_id)
        .order('name', { ascending: true });

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error loading classes:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!className) return;
    setAdding(true);

    try {
      const { data: profile } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('classes')
        .insert([{ 
          name: className, 
          school_id: profile.school_id 
        }]);

      if (error) throw error;
      
      setClassName('');
      fetchClasses();
      showNotification('Class added successfully!');
    } catch (error) {
      showNotification('Error adding class: ' + error.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const deleteClass = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this class? Students must be moved or removed first.')) return;
    try {
      await deleteClassCascade(id);
      fetchClasses();
      showNotification('Class deleted successfully!');
    } catch (error) {
      showNotification('Delete failed: ' + error.message, 'error');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('classes')
        .update({ name: editing.name.trim() })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      fetchClasses();
    } catch (error) {
      showNotification('Update failed: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 text-slate-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Class Registry</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm lg:text-base">Manage and organize your institution's academic tiers.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search classes..."
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all w-full sm:w-64 lg:w-80 shadow-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={18} />
          </div>
          <div className="flex items-center gap-4 bg-slate-900 px-5 py-2.5 rounded-2xl shadow-xl border border-slate-800 self-start">
            <div className="flex items-center gap-2">
              <LayoutGrid className="text-primary-400" size={18} />
              <span className="text-xs lg:text-sm font-bold text-slate-100">
                {searchTerm ? `${filteredClasses.length} Found` : `${classes.length} Active`}
              </span>
            </div>
            <div className="w-[1px] h-4 bg-slate-800"></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total: {totalFilteredStudents}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                  M: {totalFilteredMales}
                </span>
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                  F: {totalFilteredFemales}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Class Form */}
      <div className="bg-slate-900 p-5 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-2xl border border-slate-800">
        <form onSubmit={handleAddClass} className="flex flex-col sm:flex-row gap-3 lg:gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={placeholder}
              className="input-field pl-11 text-sm lg:text-base"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              required
            />
            <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="btn-primary py-3 lg:py-4 px-6 lg:px-8 text-xs lg:text-sm font-black uppercase tracking-widest shadow-glow"
          >
            {adding ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> Create Class</>}
          </button>
        </form>
      </div>

      {/* Classes List - Responsive View */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800">
            <Loader2 className="animate-spin text-primary-400 mx-auto mb-4" size={32} />
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Retrieving Registry...</p>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 border-dashed">
            <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-800 mb-4">
              <GraduationCap size={32} />
            </div>
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">
              {searchTerm ? 'No matching classes found' : 'No classes registered yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Designation</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Enrollment Breakdown</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredClasses.map((cls) => {
                    const enrolledStudents = getEnrolledStudents(cls.students);
                    const totalStudents = enrolledStudents.length;
                    const maleStudents = enrolledStudents.filter(s => s.gender === 'Male').length;
                    const femaleStudents = enrolledStudents.filter(s => s.gender === 'Female').length;
                    
                    return (
                      <tr 
                        key={cls.id} 
                        onClick={() => navigate(`/classes/${cls.id}`)}
                        className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-primary-600 group-hover:text-white transition-colors border border-primary-500/10 group-hover:shadow-glow">
                              {cls.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-black text-slate-200 tracking-tight truncate max-w-[200px]" title={cls.name}>{cls.name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-100 uppercase tracking-widest">Total: {totalStudents}</span>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                                  <div className="w-1 h-1 bg-blue-500 rounded-full"></div> M: {maleStudents}
                                </span>
                                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                                  <div className="w-1 h-1 bg-rose-500 rounded-full"></div> F: {femaleStudents}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClassForBulk(cls);
                              setShowBulkModal(true);
                            }}
                            className="p-3 text-slate-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-all"
                            title="Bulk Assign Subjects"
                          >
                            <BookOpen size={18} />
                          </button>
                          <RowActions
                            onEdit={() => setEditing({ id: cls.id, name: cls.name })}
                            onDelete={() => deleteClass(cls.id)}
                          />
                          <div className="p-3 text-slate-700 group-hover:text-primary-400 transition-all">
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredClasses.map((cls) => {
                const enrolledStudents = getEnrolledStudents(cls.students);
                const totalStudents = enrolledStudents.length;
                const maleStudents = enrolledStudents.filter(s => s.gender === 'Male').length;
                const femaleStudents = enrolledStudents.filter(s => s.gender === 'Female').length;

                return (
                  <div 
                    key={cls.id} 
                    onClick={() => navigate(`/classes/${cls.id}`)}
                    className="bg-slate-900 p-4 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border border-primary-500/10 group-active:bg-primary-600 group-active:text-white transition-colors shadow-glow">
                        {cls.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-slate-100 tracking-tight truncate text-sm leading-none" title={cls.name}>{cls.name}</h3>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">T: {totalStudents}</span>
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">M: {maleStudents}</span>
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">F: {femaleStudents}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClassForBulk(cls);
                          setShowBulkModal(true);
                        }}
                        className="p-2 text-slate-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-all"
                        title="Bulk Assign Subjects"
                      >
                        <BookOpen size={16} />
                      </button>
                      <RowActions
                        onEdit={() => setEditing({ id: cls.id, name: cls.name })}
                        onDelete={() => deleteClass(cls.id)}
                      />
                      <ArrowRight size={16} className="text-slate-700 group-hover:text-primary-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <EditModal open={!!editing} title="Edit class" onClose={() => setEditing(null)} onSave={saveEdit} saving={saving}>
        <input
          className="input-field w-full"
          value={editing?.name || ''}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
        />
      </EditModal>

      <BulkSubjectAssignModal
        classInfo={selectedClassForBulk}
        isOpen={showBulkModal}
        onClose={() => {
          setShowBulkModal(false);
          setSelectedClassForBulk(null);
        }}
        schoolId={schoolId}
      />
    </div>
  );
};

export default Classes;
