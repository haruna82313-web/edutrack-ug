import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Plus, BookOpen, Target, Calendar, Loader2 } from 'lucide-react';
import EditModal from '../../components/admin/EditModal';
import RowActions from '../../components/admin/RowActions';
import { deleteSyllabusTopic } from '../../lib/adminCrud';

const SyllabusManager = () => {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ subjectId: '', classId: '', term: '1', title: '', competency: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: s } = await supabase.from('subjects').select('*');
    const { data: c } = await supabase.from('classes').select('*');
    const { data: t } = await supabase.from('syllabus_topics').select('*, subjects(name), classes(name)').order('order_index');
    setSubjects(s || []); setClasses(c || []); setTopics(t || []);
    setLoading(false);
  };

  const handleAddTopic = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const { data: prof } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      const { error } = await supabase.from('syllabus_topics').insert([{
        school_id: prof.school_id,
        subject_id: formData.subjectId,
        class_id: formData.classId,
        term: parseInt(formData.term),
        topic_title: formData.title,
        competency_description: formData.competency
      }]);
      if (error) throw error;
      setFormData({ ...formData, title: '', competency: '' });
      fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('syllabus_topics').update({
        subject_id: editing.subject_id,
        class_id: editing.class_id,
        term: parseInt(editing.term),
        topic_title: editing.topic_title,
        competency_description: editing.competency_description,
      }).eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      fetchData();
    } catch (err) {
      alert('Update failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this syllabus topic?')) return;
    try {
      await deleteSyllabusTopic(id);
      fetchData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <BookOpen className="text-primary-400" size={32} /> Syllabus Planning
          </h2>
          <p className="text-slate-500 mt-1 font-medium text-sm lg:text-base">Define instructional goals and competencies for the curriculum.</p>
        </div>
      </div>
      
      <div className="bg-slate-900 p-6 lg:p-10 rounded-3xl lg:rounded-[2.5rem] shadow-2xl border border-slate-800">
        <form onSubmit={handleAddTopic} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Subject</label>
              <select className="input-field" value={formData.subjectId} onChange={e => setFormData({...formData, subjectId: e.target.value})} required>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Class</label>
              <select className="input-field" value={formData.classId} onChange={e => setFormData({...formData, classId: e.target.value})} required>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Term</label>
              <select className="input-field" value={formData.term} onChange={e => setFormData({...formData, term: e.target.value})}>
                <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Topic Title</label>
            <input type="text" placeholder="e.g. Set Theory, Geometry..." className="input-field" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Competency Description</label>
            <textarea placeholder="Outline the specific goals from NCDC guide..." className="input-field min-h-[100px]" value={formData.competency} onChange={e => setFormData({...formData, competency: e.target.value})} />
          </div>
          <button disabled={adding} className="btn-primary w-full py-4 text-sm font-black uppercase tracking-widest shadow-glow">
            {adding ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={18} /> Add to Syllabus</>}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800">
            <Loader2 className="animate-spin text-primary-400 mx-auto mb-4" size={32} />
          </div>
        ) : topics.length === 0 ? (
          <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800 border-dashed">
            <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">No topics defined in syllabus</p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
            {topics.map(t => (
              <div key={t.id} className="p-6 lg:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-800/30 transition-all group">
                <div className="flex items-start gap-5 min-w-0 flex-1">
                  <div className="w-12 h-12 bg-primary-600/10 text-primary-400 rounded-2xl flex items-center justify-center shrink-0 border border-primary-500/10">
                    <Target size={24} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">{t.classes?.name}</span>
                      <span className="text-slate-700 text-xs">•</span>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={10} /> Term {t.term}
                      </span>
                    </div>
                    <h4 className="font-black text-white text-lg tracking-tight">{t.topic_title}</h4>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">{t.subjects?.name}</p>
                    {t.competency_description && (
                      <p className="text-slate-500 text-xs mt-3 leading-relaxed max-w-2xl">{t.competency_description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-primary-500/10 text-primary-400 border-primary-500/20'
                  }`}>{t.status}</span>
                  <RowActions
                    onEdit={() => setEditing({
                      id: t.id,
                      subject_id: t.subject_id,
                      class_id: t.class_id,
                      term: String(t.term),
                      topic_title: t.topic_title,
                      competency_description: t.competency_description || '',
                    })}
                    onDelete={() => handleDelete(t.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditModal open={!!editing} title="Edit syllabus topic" onClose={() => setEditing(null)} onSave={saveEdit} saving={saving}>
        <select className="input-field w-full" value={editing?.subject_id || ''} onChange={(e) => setEditing({ ...editing, subject_id: e.target.value })}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input-field w-full" value={editing?.class_id || ''} onChange={(e) => setEditing({ ...editing, class_id: e.target.value })}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input-field w-full" value={editing?.term || '1'} onChange={(e) => setEditing({ ...editing, term: e.target.value })}>
          <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
        </select>
        <input className="input-field w-full" value={editing?.topic_title || ''} onChange={(e) => setEditing({ ...editing, topic_title: e.target.value })} />
        <textarea className="input-field w-full min-h-[100px]" value={editing?.competency_description || ''} onChange={(e) => setEditing({ ...editing, competency_description: e.target.value })} />
      </EditModal>
    </div>
  );
};

export default SyllabusManager;
