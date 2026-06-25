import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, BookOpen, Loader2, Library, Search, Trash2, Edit2 } from 'lucide-react';
import EditModal from '../../components/admin/EditModal';
import RowActions from '../../components/admin/RowActions';
import { deleteSubjectCascade } from '../../lib/adminCrud';

const Subjects = () => {
  const { user, profile } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjectLevel, setSubjectLevel] = useState('O');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [paperConfigs, setPaperConfigs] = useState([]);
  const [paperName, setPaperName] = useState('');
  const [paperMaxMark, setPaperMaxMark] = useState('100');
  const [paperWeight, setPaperWeight] = useState('33.33');
  const [addingPaper, setAddingPaper] = useState(false);

  const filteredSubjects = subjects.filter(sub => 
    sub.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const schoolType = profile?.schools?.type;

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const { data: profileData } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('school_id', profileData.school_id)
        .order('name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error loading subjects:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaperConfigs = async (subjectId) => {
    if (!subjectId) {
      setPaperConfigs([]);
      return;
    }
    try {
      const { data: profileData } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      
      const { data, error } = await supabase
        .from('subject_paper_configs')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('school_id', profileData.school_id)
        .order('paper_name');

      if (error) throw error;
      setPaperConfigs(data || []);
    } catch (error) {
      console.error('Error loading paper configs:', error.message);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchPaperConfigs(selectedSubject.id);
    }
  }, [selectedSubject]);

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
      const { data: profileData } = await supabase.from('users').select('school_id').eq('id', user.id).single();

      const { error } = await supabase.from('subjects').insert([{ 
        name: normalizedName, 
        school_id: profileData.school_id,
        level: schoolType === 'primary' ? null : subjectLevel
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
      if (selectedSubject?.id === id) {
        setSelectedSubject(null);
      }
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

  const handleAddPaper = async (e) => {
    e.preventDefault();
    if (!paperName.trim() || !selectedSubject) return;
    
    const currentLevel = selectedSubject?.level || 'O';
    const maxPapers = currentLevel === 'O' ? 2 : 999; // O-Level max 2, A-Level unlimited
    
    if (currentLevel === 'O' && paperConfigs.length >= 2) {
      alert('O-Level subjects can have a maximum of 2 papers!');
      return;
    }

    setAddingPaper(true);

    try {
      const { data: profileData } = await supabase.from('users').select('school_id').eq('id', user.id).single();

      const { error } = await supabase.from('subject_paper_configs').insert([{ 
        subject_id: selectedSubject.id,
        school_id: profileData.school_id,
        paper_name: paperName.trim(),
        max_possible_raw_mark: parseInt(paperMaxMark),
        paper_weight_percentage: parseFloat(paperWeight)
      }]);

      if (error) throw error;
      
      setPaperName('');
      setPaperMaxMark('100');
      setPaperWeight('33.33');
      fetchPaperConfigs(selectedSubject.id);
    } catch (error) {
      alert('Error adding paper: ' + error.message);
    } finally {
      setAddingPaper(false);
    }
  };

  const handleDeletePaper = async (paperId) => {
    if (!confirm('Delete this paper configuration?')) return;
    try {
      const { error } = await supabase
        .from('subject_paper_configs')
        .delete()
        .eq('id', paperId);
      
      if (error) throw error;
      fetchPaperConfigs(selectedSubject.id);
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  const totalWeight = paperConfigs.reduce((sum, p) => sum + p.paper_weight_percentage, 0);
  const weightWarning = totalWeight > 0 && Math.abs(totalWeight - 100) > 0.1;
  const currentLevel = selectedSubject?.level || 'O';
  const maxPapers = currentLevel === 'O' ? 2 : 999;
  const atPaperLimit = schoolType !== 'primary' && currentLevel === 'O' && paperConfigs.length >= maxPapers;

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Subject Form & Subjects List */}
        <div className="space-y-6">
          {/* Add Subject Form */}
          <div className="bg-slate-900 p-5 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-2xl border border-slate-800">
            <form onSubmit={handleAddSubject} className="flex flex-col gap-3 lg:gap-4">
              <div className="flex flex-col sm:flex-row gap-3">
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
                {schoolType !== 'primary' && (
                  <div className="w-full sm:w-auto">
                    <select
                      value={subjectLevel}
                      onChange={(e) => setSubjectLevel(e.target.value)}
                      className="input-field text-sm font-bold"
                    >
                      <option value="O">O-Level</option>
                      <option value="A">A-Level</option>
                    </select>
                  </div>
                )}
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
              <div className="space-y-3">
                {filteredSubjects.map((sub) => (
                  <div 
                    key={sub.id} 
                    onClick={() => setSelectedSubject(selectedSubject?.id === sub.id ? null : sub)}
                    className={`bg-slate-900 p-4 rounded-2xl shadow-xl border transition-all cursor-pointer ${selectedSubject?.id === sub.id ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-800 hover:border-primary-500/30'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedSubject?.id === sub.id ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                          <BookOpen size={20} />
                        </div>
                        <div className="flex flex-col">
                          <h3 className="font-black text-slate-100 tracking-tight">
                            {sub.name}
                          </h3>
                          {schoolType !== 'primary' && sub.level && (
                            <span className={`text-[10px] font-black uppercase tracking-widest ${sub.level === 'A' ? 'text-blue-400' : 'text-emerald-400'}`}>
                              {sub.level === 'A' ? 'A-Level' : 'O-Level'}
                            </span>
                          )}
                        </div>
                      </div>
                      <RowActions
                        onEdit={() => setEditing({ id: sub.id, name: sub.name })}
                        onDelete={() => handleDeleteSubject(sub.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Paper Configuration Panel */}
        {schoolType !== 'primary' && (
          <div className="bg-slate-900 p-5 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-2xl border border-slate-800">
            {selectedSubject ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="w-12 h-12 bg-primary-600/10 text-primary-400 rounded-2xl flex items-center justify-center">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{selectedSubject.name}</h3>
                    <span className={`text-xs font-black uppercase tracking-widest ${currentLevel === 'A' ? 'text-blue-400' : 'text-emerald-400'}`}>
                      {currentLevel === 'A' ? 'A-Level' : 'O-Level'} • Max Papers: {currentLevel === 'O' ? '2' : 'Unlimited'}
                    </span>
                  </div>
                </div>

                {/* Add Paper Form */}
                <form onSubmit={handleAddPaper} className="space-y-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Add New Paper</h4>
                  
                  {/* Paper Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paper Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Paper 1, Theory, Practical..."
                      className="input-field text-sm"
                      value={paperName}
                      onChange={(e) => setPaperName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Max Marks & Weight */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Max Possible Mark</label>
                      <input
                        type="number"
                        placeholder="100"
                        min="1"
                        className="input-field text-sm"
                        value={paperMaxMark}
                        onChange={(e) => setPaperMaxMark(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Weight (%)</label>
                      <input
                        type="number"
                        placeholder="33.33"
                        min="0.01"
                        max="100"
                        step="0.01"
                        className="input-field text-sm"
                        value={paperWeight}
                        onChange={(e) => setPaperWeight(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={addingPaper || atPaperLimit}
                    className="btn-primary w-full py-3 text-xs font-black uppercase tracking-widest shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingPaper ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} /> Add Paper</>}
                  </button>
                  {atPaperLimit && (
                    <p className="text-amber-500 text-xs font-bold uppercase tracking-widest">
                      ⚠️ O-Level subjects can have a maximum of 2 papers!
                    </p>
                  )}
                </form>

                {/* Weight Warning */}
                {weightWarning && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl">
                    <p className="text-amber-500 text-xs font-black uppercase tracking-widest">
                      ⚠️ Total weight: {totalWeight.toFixed(2)}% — should be 100%
                    </p>
                  </div>
                )}

                {/* Paper List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Configured Papers ({paperConfigs.length})
                  </h4>
                  {paperConfigs.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-sm">
                      No papers configured yet. Add papers above!
                    </div>
                  ) : (
                    paperConfigs.map((paper) => (
                      <div key={paper.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div className="space-y-1">
                          <h5 className="font-black text-slate-200">{paper.paper_name}</h5>
                          <p className="text-xs text-slate-500 font-bold">
                            Max: {paper.max_possible_raw_mark} • Weight: {paper.paper_weight_percentage}%
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeletePaper(paper.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-600 mb-4">
                  <Edit2 size={32} />
                </div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  Select a subject to manage papers
                </p>
              </div>
            )}
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
