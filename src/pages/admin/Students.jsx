import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Loader2, Users, Phone, GraduationCap, Search, Archive, CheckCircle, BookOpen } from 'lucide-react';
import EditModal from '../../components/admin/EditModal';
import RowActions from '../../components/admin/RowActions';
import { deleteStudentCascade } from '../../lib/adminCrud';
import SelectField from '../../components/admin/SelectField';
import { ShieldCheck, Star } from 'lucide-react';
import StudentDetailsModal from '../../components/admin/StudentDetailsModal';
import { StudentSubjectsModal } from '../../components/admin/StudentSubjectsModal';

import { useNotification } from '../../context/NotificationContext';

const STUDENT_STATUSES = [
  { value: 'active', label: 'Active', color: 'emerald' },
  { value: 'inactive', label: 'Inactive', color: 'slate' },
  { value: 'graduated', label: 'Graduated', color: 'blue' },
  { value: 'transferred', label: 'Transferred', color: 'amber' },
  { value: 'suspended', label: 'Suspended', color: 'red' }
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Students' },
  ...STUDENT_STATUSES.map(s => ({ value: s.value, label: s.label }))
];

const LEADERSHIP_ROLES = [
  { value: 'class_rep', label: 'Class Representative' },
  { value: 'prefect', label: 'Prefect' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'class_leader', label: 'Class Leader' },
  { value: 'religious_leader', label: 'Religious Leader' },
];

const Students = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterRole, setFilterRole] = useState('all'); // all, leaders, non_leaders, or specific role value
  const [filterGender, setFilterGender] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [archiving, setArchiving] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveStatus, setArchiveStatus] = useState('inactive');
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [selectedStudentForSubjects, setSelectedStudentForSubjects] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    parentPhone: '',
    classId: '',
    leadershipRole: '',
    gender: ''
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      const currentSchoolId = profile?.school_id;
      setSchoolId(currentSchoolId);
      const classQuery = supabase.from('classes').select('*').order('name');
      const { data: classData, error: classErr } = currentSchoolId
        ? await classQuery.eq('school_id', currentSchoolId)
        : await classQuery;
      if (classErr) throw classErr;
      setClasses(classData || []);

      let studentQuery = supabase
        .from('students')
        .select('*, classes(name)')
        .order('full_name', { ascending: true });
      if (schoolId) {
        studentQuery = studentQuery.eq('school_id', schoolId);
      }
      const { data: studentData, error } = await studentQuery;

      if (error) throw error;
      setStudents(studentData || []);
    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = student.full_name?.toLowerCase() || '';
    const className = student.classes?.name?.toLowerCase() || '';
    
    const matchesSearch = fullName.includes(searchLower) || className.includes(searchLower);
    const matchesDate = !filterDate || (student.created_at && student.created_at.startsWith(filterDate));
    
    const matchesRole = filterRole === 'all' 
      ? true 
      : filterRole === 'leaders' 
        ? !!student.leadership_role 
        : filterRole === 'non_leaders' 
          ? !student.leadership_role 
          : student.leadership_role === filterRole;

    const matchesGender = filterGender === 'all' || student.gender === filterGender;
    const matchesStatus = filterStatus === 'all' || (student.status || 'active') === filterStatus;
    
    return matchesSearch && matchesDate && matchesRole && matchesGender && matchesStatus;
  });

  const archiveStudent = async () => {
    if (!archiving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          status: archiveStatus,
          archived_at: new Date().toISOString(),
          archive_reason: archiveReason || null
        })
        .eq('id', archiving.id);
      if (error) throw error;
      setArchiving(null);
      setArchiveReason('');
      fetchData();
      showNotification(`Student ${archiveStatus === 'active' ? 'reactivated' : 'archived'} successfully!`);
    } catch (error) {
      showNotification('Archive failed: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const reactivateStudent = async (student) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('students')
        .update({
          status: 'active',
          archived_at: null,
          archive_reason: null
        })
        .eq('id', student.id);
      if (error) throw error;
      fetchData();
      showNotification('Student reactivated successfully!');
    } catch (error) {
      showNotification('Reactivate failed: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const maleCount = filteredStudents.filter(s => s.gender === 'Male').length;
  const femaleCount = filteredStudents.filter(s => s.gender === 'Female').length;

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();

      const { error } = await supabase.from('students').insert([{
        full_name: formData.fullName,
        parent_phone: formData.parentPhone,
        class_id: formData.classId,
        school_id: profile.school_id,
        leadership_role: formData.leadershipRole || null,
        gender: formData.gender || null
      }]);

      if (error) throw error;
      
      setFormData({ fullName: '', parentPhone: '', classId: '', leadershipRole: '', gender: '' });
      fetchData();
      showNotification('Student profile activated successfully!');
    } catch (error) {
      showNotification('Activation failure: ' + error.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const deleteStudent = async (id) => {
    if (!window.confirm('Are you sure you want to remove this student? All academic records will be permanently deleted.')) return;
    try {
      await deleteStudentCascade(id);
      fetchData();
      showNotification('Student record purged from the matrix.');
    } catch (error) {
      showNotification('Purge failure: ' + error.message, 'error');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          full_name: editing.full_name.trim(),
          parent_phone: editing.parent_phone.trim(),
          class_id: editing.class_id,
          leadership_role: editing.leadership_role || null,
          gender: editing.gender || null
        })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      fetchData();
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
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Student Directory</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm lg:text-base">Complete registry of all enrolled students.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search students, classes..."
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all w-full sm:w-64 lg:w-80 shadow-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={18} />
          </div>
          <div className="relative flex items-center bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800">
            <ShieldCheck className="text-slate-500 mr-2" size={16} />
            <select
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-300 focus:ring-0 cursor-pointer outline-none"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="all" className="bg-slate-900 text-white">All Tiers</option>
              <option value="leaders" className="bg-slate-900 text-emerald-400 font-bold">All Leaders</option>
              <option value="non_leaders" className="bg-slate-900 text-slate-400">Non-Leaders</option>
              <optgroup label="Specific Roles" className="bg-slate-950 text-primary-400 font-black">
                {LEADERSHIP_ROLES.map(role => (
                  <option key={role.value} value={role.value} className="bg-slate-900 text-slate-200 uppercase tracking-widest">{role.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="relative flex items-center bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800">
            <Users className="text-slate-500 mr-2" size={16} />
            <select
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-300 focus:ring-0 cursor-pointer outline-none"
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
            >
              <option value="all" className="bg-slate-900 text-white">All Genders</option>
              <option value="Male" className="bg-slate-900 text-white">Male</option>
              <option value="Female" className="bg-slate-900 text-white">Female</option>
            </select>
          </div>
          <div className="relative flex items-center bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800">
            <CheckCircle className="text-slate-500 mr-2" size={16} />
            <select
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-300 focus:ring-0 cursor-pointer outline-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex items-center bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800">
            <input
              type="date"
              className="bg-transparent border-none text-xs font-bold text-slate-300 focus:ring-0 cursor-pointer"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            {filterDate && (
              <button 
                onClick={() => setFilterDate('')}
                className="ml-2 text-slate-500 hover:text-white"
              >
                <Search size={14} className="rotate-45" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 bg-slate-900 px-5 py-2.5 rounded-2xl shadow-xl border border-slate-800 self-start">
            <div className="flex items-center gap-2">
              <Users className="text-primary-400" size={18} />
              <span className="text-xs lg:text-sm font-bold text-slate-100">{filteredStudents.length}</span>
            </div>
            <div className="w-[1px] h-4 bg-slate-800"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">M: {maleCount}</span>
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">F: {femaleCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Student Form */}
      <div className="bg-slate-900 p-5 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-2xl border border-slate-800">
        <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Full Name"
              className="input-field pl-11 text-sm lg:text-base"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              required
            />
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Parent Phone"
              className="input-field pl-11 text-sm lg:text-base"
              value={formData.parentPhone}
              onChange={(e) => setFormData({...formData, parentPhone: e.target.value})}
              required
            />
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          </div>
          <SelectField
            icon={GraduationCap}
            value={formData.classId}
            onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
            required
            className="text-sm lg:text-base"
          >
            <option value="">Select stream / class</option>
            {classes.length === 0 ? (
              <option value="" disabled>
                No streams — create classes first
              </option>
            ) : (
              classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </SelectField>
          <SelectField
            icon={ShieldCheck}
            value={formData.leadershipRole}
            onChange={(e) => setFormData({ ...formData, leadershipRole: e.target.value })}
            className="text-sm lg:text-base"
          >
            <option value="">No Leadership Role</option>
            {LEADERSHIP_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            icon={Users}
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            required
            className="text-sm lg:text-base"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </SelectField>
          <button 
            type="submit" 
            disabled={adding}
            className="btn-primary py-3 lg:py-4 px-6 lg:px-8 text-xs lg:text-sm font-black uppercase tracking-widest shadow-glow"
          >
            {adding ? <Loader2 className="animate-spin" size={18} /> : <><UserPlus size={18} /> Add Student</>}
          </button>
        </form>
      </div>

      {/* Students List - Responsive View */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800">
            <Loader2 className="animate-spin text-primary-400 mx-auto mb-4" size={32} />
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Accessing Student Files...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 border-dashed">
            <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-800 mb-4">
              <Users size={32} />
            </div>
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">
              {searchTerm ? 'No matching students found' : 'Registry is empty'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Class</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => { setSelectedStudent(student); setShowDetails(true); }}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border transition-all ${
                            student.leadership_role 
                              ? 'bg-aurora-amber/20 text-aurora-amber border-aurora-amber/20 shadow-neon-amber' 
                              : 'bg-primary-600/10 text-primary-400 border-primary-500/10 group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-glow'
                          }`}>
                            {student.leadership_role ? <Star size={16} /> : student.full_name.substring(0, 1).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-200 tracking-tight truncate max-w-[200px]" title={student.full_name}>
                                {student.full_name}
                              </span>
                              {student.gender && (
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${student.gender === 'Male' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                  {student.gender === 'Male' ? 'M' : 'F'}
                                </span>
                              )}
                              {(() => {
                                const st = STUDENT_STATUSES.find(s => s.value === (student.status || 'active'));
                                return st && st.value !== 'active' ? (
                                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter border border-${st.color}-500/20 bg-${st.color}-500/10 text-${st.color}-400`}>
                                    {st.label}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            {student.leadership_role && (
                              <span className="text-[9px] font-black text-aurora-amber uppercase tracking-widest flex items-center gap-1">
                                <ShieldCheck size={10} /> {LEADERSHIP_ROLES.find(r => r.value === student.leadership_role)?.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-950 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-800 group-hover:border-primary-500/20 group-hover:text-primary-400 transition-all">
                          {student.classes?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <a 
                          href={`tel:${student.parent_phone}`}
                          className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-primary-400 transition-colors"
                        >
                          <Phone size={14} className="text-primary-500" /> {student.parent_phone}
                        </a>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(student.status || 'active') === 'active' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentForSubjects(student);
                                setShowSubjectsModal(true);
                              }}
                              className="p-3 text-slate-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-all"
                              title="Manage Subjects"
                            >
                              <BookOpen size={18} />
                            </button>
                          )}
                          {(student.status || 'active') === 'active' ? (
                            <RowActions
                              onEdit={() => setEditing({ ...student, class_id: student.class_id })}
                              onDelete={() => {
                                setArchiving(student);
                                setArchiveReason('');
                                setArchiveStatus('inactive');
                              }}
                              customDeleteIcon={Archive}
                              customDeleteLabel="Archive"
                            />
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); reactivateStudent(student); }}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                            >
                              <CheckCircle size={12} /> Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3">
              {filteredStudents.map((student) => (
                <div 
                  key={student.id} 
                  onClick={() => { setSelectedStudent(student); setShowDetails(true); }}
                  className={`bg-slate-900 p-4 rounded-2xl shadow-xl border flex flex-col gap-3 group active:scale-[0.98] transition-all cursor-pointer ${student.leadership_role ? 'border-aurora-amber/30 shadow-neon-amber' : 'border-slate-800'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border shadow-glow ${student.leadership_role ? 'bg-aurora-amber/20 text-aurora-amber border-aurora-amber/20' : 'bg-primary-600/10 text-primary-400 border-primary-500/10'}`}>
                        {student.leadership_role ? <Star size={16} /> : student.full_name.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-slate-100 tracking-tight truncate text-sm leading-none" title={student.full_name}>{student.full_name}</h3>
                          {student.gender && (
                            <span className={`text-[7px] font-black px-1 py-0.5 rounded uppercase tracking-tighter ${student.gender === 'Male' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {student.gender === 'Male' ? 'M' : 'F'}
                            </span>
                          )}
                          {(() => {
                            const st = STUDENT_STATUSES.find(s => s.value === (student.status || 'active'));
                            return st && st.value !== 'active' ? (
                              <span className={`text-[7px] font-black px-1 py-0.5 rounded-full uppercase tracking-tighter border border-${st.color}-500/20 bg-${st.color}-500/10 text-${st.color}-400`}>
                                {st.label}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-950 text-slate-500 text-[8px] font-black uppercase tracking-wider border border-slate-800">
                            {student.classes?.name || 'Unassigned'}
                          </span>
                          {student.leadership_role && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-aurora-amber/10 text-aurora-amber text-[8px] font-black uppercase tracking-wider border border-aurora-amber/20">
                              {LEADERSHIP_ROLES.find(r => r.value === student.leadership_role)?.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {(student.status || 'active') === 'active' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudentForSubjects(student);
                            setShowSubjectsModal(true);
                          }}
                          className="p-2 text-slate-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-all"
                          title="Manage Subjects"
                        >
                          <BookOpen size={16} />
                        </button>
                      )}
                      {(student.status || 'active') === 'active' ? (
                        <RowActions
                          onEdit={() => setEditing({ ...student, class_id: student.class_id })}
                          onDelete={() => {
                            setArchiving(student);
                            setArchiveReason('');
                            setArchiveStatus('inactive');
                          }}
                          customDeleteIcon={Archive}
                          customDeleteLabel="Archive"
                        />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); reactivateStudent(student); }}
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                        >
                          <CheckCircle size={10} /> Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px]">
                      <Phone size={12} className="text-primary-500" /> 
                      <span className="tracking-wider">{student.parent_phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-[9px] uppercase tracking-widest">
                      Node: {student.school_id.substring(0, 4)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <EditModal
        open={!!editing}
        title="Edit student"
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        saving={saving}
      >
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full name</label>
          <input
            className="input-field w-full"
            value={editing?.full_name || ''}
            onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Parent / guardian phone</label>
          <input
            className="input-field w-full"
            value={editing?.parent_phone || ''}
            onChange={(e) => setEditing({ ...editing, parent_phone: e.target.value })}
          />
        </div>
        <SelectField
          label="Stream / class (all streams in your school)"
          icon={GraduationCap}
          value={editing?.class_id || ''}
          onChange={(e) => setEditing({ ...editing, class_id: e.target.value })}
          required
        >
          <option value="" disabled>
            Choose stream
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Leadership Role"
          icon={ShieldCheck}
          value={editing?.leadership_role || ''}
          onChange={(e) => setEditing({ ...editing, leadership_role: e.target.value })}
        >
          <option value="">No Leadership Role</option>
          {LEADERSHIP_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Gender"
          icon={Users}
          value={editing?.gender || ''}
          onChange={(e) => setEditing({ ...editing, gender: e.target.value })}
          required
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </SelectField>
        {classes.length === 0 && (
          <p className="text-[10px] text-aurora-amber font-black uppercase tracking-widest">
            Add classes under Classes to assign streams.
          </p>
        )}
      </EditModal>

      {/* Archive Modal */}
      {archiving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-400 border border-red-500/20">
                <Archive size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Archive student</h3>
                <p className="text-slate-400 text-sm font-medium">
                  You're archiving <span className="text-white font-bold">{archiving.full_name}</span>
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Status change
                </label>
                <div className="relative flex items-center bg-slate-950 px-4 py-3 rounded-2xl border border-slate-800">
                  <select
                    className="w-full bg-transparent border-none text-sm font-bold text-slate-200 focus:ring-0 cursor-pointer outline-none"
                    value={archiveStatus}
                    onChange={(e) => setArchiveStatus(e.target.value)}
                  >
                    {STUDENT_STATUSES.filter(s => s.value !== 'active').map((status) => (
                      <option key={status.value} value={status.value} className="bg-slate-900 text-white">
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Reason (optional)
                </label>
                <textarea
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-none min-h-[100px]"
                  placeholder="Enter reason for status change..."
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                />
              </div>

              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                All student records (marks, attendance, etc.) will be preserved, but the student won't appear in active lists.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setArchiving(null)}
                className="flex-1 px-4 py-3 rounded-2xl bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={archiveStudent}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-2xl bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/30 border border-red-500/20 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      <StudentDetailsModal 
        student={selectedStudent} 
        open={showDetails} 
        onClose={() => setShowDetails(false)} 
      />
      
      <StudentSubjectsModal
        student={selectedStudentForSubjects}
        isOpen={showSubjectsModal}
        onClose={() => {
          setShowSubjectsModal(false);
          setSelectedStudentForSubjects(null);
        }}
        schoolId={schoolId}
      />
    </div>
  );
};

export default Students;
