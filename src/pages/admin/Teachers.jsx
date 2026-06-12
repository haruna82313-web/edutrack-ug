import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  UserPlus, 
  Clock, 
  Mail, 
  CheckCircle, 
  Loader2, 
  UserCheck, 
  ShieldCheck, 
  Search, 
  Calendar, 
  Users, 
  User,
  MoreVertical,
  Edit2,
  Trash2
} from 'lucide-react';
import RowActions from '../../components/admin/RowActions';
import EditModal from '../../components/admin/EditModal';
import { deleteTeacherInvite } from '../../lib/adminCrud';

import { useNotification } from '../../context/NotificationContext';

const Teachers = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [teachers, setTeachers] = useState([]);
  const [formData, setFormData] = useState({ fullName: '', email: '', gender: '' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [schoolId, setSchoolId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState('all');

  const filteredTeachers = teachers.filter(t => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      t.full_name?.toLowerCase().includes(query) ||
      t.email?.toLowerCase().includes(query) ||
      t.created_at?.includes(query)
    );
    const matchesGender = filterGender === 'all' || t.gender === filterGender;
    return matchesSearch && matchesGender;
  });

  const maleCount = filteredTeachers.filter(t => t.gender === 'Male').length;
  const femaleCount = filteredTeachers.filter(t => t.gender === 'Female').length;

  const fetchTeachers = async (sid) => {
    try {
      setLoading(true);
      let query = supabase
        .from('all_teachers_view')
        .select('*')
        .order('full_name');
      
      if (sid) {
        query = query.eq('school_id', sid);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error loading teachers:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      const sid = profile?.school_id;
      setSchoolId(sid);
      fetchTeachers(sid);
    })();
  }, [user.id]);

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      
      const { error } = await supabase.from('teacher_invites').insert([{ 
        full_name: formData.fullName, 
        email: formData.email.toLowerCase().trim(),
        school_id: profile.school_id,
        gender: formData.gender || null
      }]);

      if (error) {
        if (error.code === '23505') showNotification('Email already authorized!', 'error');
        else throw error;
        return;
      }

      setFormData({ fullName: '', email: '', gender: '' });
      fetchTeachers(schoolId);
      showNotification('Teacher node authorized successfully!');
    } catch (error) {
      showNotification('Authorization failure: ' + error.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteInvite = async (email) => {
    if (!window.confirm('Are you sure you want to revoke this teacher\'s access? All instructional history will be archived.')) return;
    try {
      await deleteTeacherInvite(email, schoolId);
      fetchTeachers(schoolId);
      showNotification('Staff node deactivated successfully.');
    } catch (error) {
      showNotification('Deactivation failure: ' + error.message, 'error');
    }
  };

  const saveEditTeacher = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.is_registered) {
        // Update registered teacher in users table
        const { error } = await supabase
          .from('users')
          .update({
            full_name: editing.full_name.trim(),
            gender: editing.gender || null
          })
          .eq('email', editing.email)
          .eq('school_id', schoolId);
        if (error) throw error;
      } else {
        // Update invited teacher in teacher_invites table
        const { error } = await supabase
          .from('teacher_invites')
          .update({
            full_name: editing.full_name.trim(),
            email: editing.email.toLowerCase().trim(),
            gender: editing.gender || null
          })
          .eq('email', editing.originalEmail)
          .eq('school_id', schoolId);
        if (error) throw error;
      }
      setEditing(null);
      fetchTeachers(schoolId);
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
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Staff Authorization</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm lg:text-base">Grant and manage access for your instructional team.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search staff by name or email..."
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all w-full sm:w-64 lg:w-80 shadow-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={18} />
          </div>
          <div className="relative flex items-center bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800">
            <Users className="text-slate-500 mr-2" size={16} />
            <select
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-300 focus:ring-0 cursor-pointer outline-none"
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
            >
              <option value="all" className="bg-slate-900 text-white">All Staff</option>
              <option value="Male" className="bg-slate-900 text-white">Males Only</option>
              <option value="Female" className="bg-slate-900 text-white">Females Only</option>
            </select>
          </div>
          <div className="flex items-center gap-4 bg-slate-900 px-5 py-2.5 rounded-2xl shadow-xl border border-slate-800 self-start">
            <div className="flex items-center gap-2">
              <UserCheck className="text-primary-400" size={18} />
              <span className="text-xs lg:text-sm font-bold text-slate-100">{filteredTeachers.length}</span>
            </div>
            <div className="w-[1px] h-4 bg-slate-800"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">M: {maleCount}</span>
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">F: {femaleCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Authorization Form */}
      <div className="bg-slate-900 p-5 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-2xl border border-slate-800">
        <form onSubmit={handleAddTeacher} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Teacher Full Name"
              className="input-field pl-11 text-sm lg:text-base"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              required
            />
            <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          </div>
          <div className="relative">
            <input
              type="email"
              placeholder="Email Address"
              className="input-field pl-11 text-sm lg:text-base"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          </div>
          <div className="relative">
            <select
              className="input-field pl-11 text-sm lg:text-base appearance-none"
              value={formData.gender}
              onChange={(e) => setFormData({...formData, gender: e.target.value})}
              required
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          </div>
          <button 
            type="submit" 
            disabled={adding}
            className="btn-primary py-3 lg:py-4 px-6 lg:px-8 text-xs lg:text-sm font-black uppercase tracking-widest shadow-glow"
          >
            {adding ? <Loader2 className="animate-spin" size={18} /> : <><ShieldCheck size={18} /> Grant Access</>}
          </button>
        </form>
      </div>

      {/* Teachers List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800">
            <Loader2 className="animate-spin text-primary-400 mx-auto mb-4" size={32} />
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Verifying Credentials...</p>
          </div>
        ) : teachers.length === 0 ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 border-dashed">
            <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-800 mb-4">
              <UserCheck size={32} />
            </div>
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">No staff authorized yet</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Instructor</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Identity</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {teachers.map((teacher) => (
                    <tr key={teacher.email} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-primary-600 group-hover:text-white transition-all border border-primary-500/10 group-hover:shadow-glow">
                            {teacher.full_name.substring(0, 1).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-200 tracking-tight">{teacher.full_name}</span>
                              {teacher.gender && (
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${teacher.gender === 'Male' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                  {teacher.gender === 'Male' ? 'M' : 'F'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                          <Mail size={14} className="text-primary-500" /> {teacher.email}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${teacher.is_registered ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {teacher.is_registered ? <><CheckCircle size={12} /> Active</> : <><Clock size={12} /> Pending</>}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <RowActions
                          onEdit={() => setEditing({
                            originalEmail: teacher.email,
                            full_name: teacher.full_name,
                            email: teacher.email,
                            gender: teacher.gender,
                            is_registered: teacher.is_registered,
                          })}
                          onDelete={!teacher.is_registered ? () => handleDeleteInvite(teacher.email) : undefined}
                          deleteDisabled={teacher.is_registered}
                          deleteTitle={teacher.is_registered ? 'Active teachers cannot be removed here' : 'Revoke invite'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3">
              {teachers.map((teacher) => (
                <div key={teacher.email} className="bg-slate-900 p-4 rounded-2xl shadow-xl border border-slate-800 flex flex-col gap-3 group active:scale-[0.98] transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border border-primary-500/10 group-active:bg-primary-600 group-active:text-white transition-colors shadow-glow">
                        {teacher.full_name.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-slate-100 tracking-tight truncate text-sm leading-none" title={teacher.full_name}>{teacher.full_name}</h3>
                          {teacher.gender && (
                            <span className={`text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-tighter ${teacher.gender === 'Male' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {teacher.gender === 'Male' ? 'M' : 'F'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${teacher.is_registered ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                            {teacher.is_registered ? 'Active' : 'Awaiting Hub Connection'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <RowActions
                      onEdit={() => setEditing({
                        originalEmail: teacher.email,
                        full_name: teacher.full_name,
                        email: teacher.email,
                        gender: teacher.gender,
                        is_registered: teacher.is_registered,
                      })}
                      onDelete={!teacher.is_registered ? () => handleDeleteInvite(teacher.email) : undefined}
                      deleteDisabled={teacher.is_registered}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800/50 text-slate-500 font-bold text-[10px] truncate">
                    <Mail size={12} className="text-primary-400 shrink-0" /> 
                    <span className="truncate tracking-tight">{teacher.email}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <EditModal open={!!editing} title={editing?.is_registered ? "Edit Active Staff" : "Edit Staff Invite"} onClose={() => setEditing(null)} onSave={saveEditTeacher} saving={saving}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
            <input className="input-field w-full" value={editing?.full_name || ''} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
            <input 
              type="email" 
              className={`input-field w-full ${editing?.is_registered ? 'opacity-50 cursor-not-allowed' : ''}`} 
              value={editing?.email || ''} 
              onChange={(e) => !editing?.is_registered && setEditing({ ...editing, email: e.target.value })}
              readOnly={editing?.is_registered}
            />
            {editing?.is_registered && <p className="text-[8px] text-amber-500 uppercase font-black">Registered email cannot be changed</p>}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Gender</label>
            <select
              className="input-field w-full appearance-none"
              value={editing?.gender || ''}
              onChange={(e) => setEditing({ ...editing, gender: e.target.value })}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>
      </EditModal>
    </div>
  );
};

export default Teachers;
