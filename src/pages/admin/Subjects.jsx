import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, BookOpen, Loader2, Library, Search } from 'lucide-react';
import EditModal from '../../components/admin/EditModal';
import RowActions from '../../components/admin/RowActions';
import { deleteSubjectCascade } from '../../lib/adminCrud';

const Subjects = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSubjects = subjects.filter(sub => 
    sub.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error loading subjects:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    setAdding(true);

    const normalizedName = subjectName.trim().toUpperCase();
    const isDuplicate = subjects.some(sub => sub.name.toUpperCase() === normalizedName);

    if (isDuplicate) {
      alert(`Stop! "${normalizedName}" already exists in your list.`);
      setAdding(false);
      return;
    }

    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();

      const { error } = await supabase.from('subjects').insert([{ 
        name: normalizedName, 
        school_id: profile.school_id 
      }]);

      if (error) throw error;
      
      setSubjectName('');
      fetchSubjects();
    } catch (error) {
      alert('Error adding subject: ' + error.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!confirm('Delete this subject and unlink related lessons/topics?')) return;
    try {
      await deleteSubjectCascade(id);
      fetchSubjects();
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ name: editing.name.trim().toUpperCase() })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      fetchSubjects();
    } catch (error) {
      alert('Update failed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 text-slate-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Curriculum Map</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm lg:text-base">Define and manage the subjects offered in your institution.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search subjects..."
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all w-full sm:w-64 lg:w-80 shadow-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={18} />
          </div>
          <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800 self-start">
            <Library className="text-primary-400" size={18} />
            <span className="text-xs lg:text-sm font-bold text-slate-300">
              {searchTerm ? `${filteredSubjects.length} Found` : `${subjects.length} Active`}
            </span>
          </div>
        </div>
      </div>

      {/* Add Subject Form */}
      <div className="bg-slate-900 p-5 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-2xl border border-slate-800">
        <form onSubmit={handleAddSubject} className="flex flex-col sm:flex-row gap-3 lg:gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="e.g. MATHEMATICS, PHYSICS..."
              className="input-field pl-11 text-sm lg:text-base"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              required
            />
            <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="btn-primary py-3 lg:py-4 px-6 lg:px-8 text-xs lg:text-sm font-black uppercase tracking-widest shadow-glow"
          >
            {adding ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> Add Subject</>}
          </button>
        </form>
      </div>

      {/* Subjects List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800">
            <Loader2 className="animate-spin text-primary-400 mx-auto mb-4" size={32} />
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Scanning Curriculum...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 border-dashed">
            <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-800 mb-4">
              <BookOpen size={32} />
            </div>
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">
              {searchTerm ? 'No matching subjects found' : 'No subjects defined yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
            {filteredSubjects.map((sub) => (
              <div key={sub.id} className="bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-800 hover:border-primary-500/30 hover:-translate-y-1 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-slate-950 text-slate-800 rounded-bl-[2rem] flex items-center justify-center transition-colors group-hover:bg-primary-600 group-hover:text-white group-hover:shadow-glow">
                  <BookOpen size={20} />
                </div>
                
                <div className="relative z-10">
                  <h3 className="font-black text-slate-100 tracking-tight text-lg mb-4 break-words pr-8" title={sub.name}>
                    {sub.name}
                  </h3>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      ID: {sub.id.substring(0, 4)}
                    </span>
                    <RowActions
                      onEdit={() => setEditing({ id: sub.id, name: sub.name })}
                      onDelete={() => handleDeleteSubject(sub.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditModal open={!!editing} title="Edit subject" onClose={() => setEditing(null)} onSave={saveEdit} saving={saving}>
        <input
          className="input-field w-full"
          value={editing?.name || ''}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
        />
      </EditModal>
    </div>
  );
};

export default Subjects;
