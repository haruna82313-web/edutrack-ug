import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import EditModal from '../../components/admin/EditModal';
import RowActions from '../../components/admin/RowActions';
import {
  FileText,
  Plus,
  Loader2,
  Printer,
  Share2,
  AlertCircle,
} from 'lucide-react';
import { deleteSchoolDocument } from '../../lib/adminCrud';
import SelectField from '../../components/admin/SelectField';
import { DOC_TYPES, docTypeLabel } from '../../lib/documentTypes';

const SchoolDocuments = () => {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [form, setForm] = useState({ title: '', docType: 'circular', body: '' });

  const fetchDocs = async (sid) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('school_documents')
      .select('*')
      .eq('school_id', sid)
      .order('updated_at', { ascending: false });

    if (err) {
      if (err.message?.includes('does not exist')) {
        setError('Run supabase/migrations/002_school_documents.sql in your Supabase SQL Editor.');
      } else {
        setError(err.message);
      }
      setDocuments([]);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data: profile } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();
      setSchoolId(profile?.school_id);
      if (profile?.school_id) fetchDocs(profile.school_id);
    })();
  }, [user.id]);

  const resetForm = () => setForm({ title: '', docType: 'circular', body: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.from('school_documents').insert([
        {
          school_id: schoolId,
          title: form.title.trim(),
          doc_type: form.docType,
          body: form.body,
        },
      ]);
      if (err) throw err;
      resetForm();
      fetchDocs(schoolId);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editDoc) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('school_documents')
        .update({
          title: editDoc.title.trim(),
          doc_type: editDoc.doc_type,
          body: editDoc.body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editDoc.id);
      if (err) throw err;
      setEditDoc(null);
      fetchDocs(schoolId);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document permanently?')) return;
    try {
      await deleteSchoolDocument(id);
      if (previewDoc?.id === id) setPreviewDoc(null);
      fetchDocs(schoolId);
    } catch (err) {
      alert(err.message);
    }
  };

  const printDocument = (doc) => {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Allow pop-ups to print this document.');
      return;
    }
    win.document.write(`
      <!DOCTYPE html><html><head><title>${doc.title}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 24px; color: #111; }
        h1 { font-size: 22px; margin-bottom: 8px; }
        .meta { font-size: 12px; color: #555; margin-bottom: 24px; text-transform: uppercase; }
        .body { white-space: pre-wrap; line-height: 1.6; font-size: 14px; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h1>${doc.title}</h1>
      <p class="meta">${doc.doc_type} · ${new Date(doc.updated_at || doc.created_at).toLocaleString()}</p>
      <div class="body">${doc.body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      <script>window.onload = () => { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  };

  const shareDocument = async (doc) => {
    const text = `${doc.title}\n\n${doc.body}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: doc.title, text });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('Document copied. Paste into WhatsApp, email, or another device to share or print.');
    } catch {
      alert('Copy failed. Use Print instead, or select text manually.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-white">
      <div>
        <h2 className="text-2xl lg:text-3xl font-black tracking-tighter uppercase flex items-center gap-3">
          <FileText className="text-aurora-cyan" /> School documents
        </h2>
        <p className="text-slate-400 mt-2 text-sm">
          Type circulars and notices. Print or share between devices.
        </p>
      </div>

      {error && (
        <div className="bg-aurora-rose/10 border border-aurora-rose/20 text-aurora-rose px-6 py-4 rounded-2xl flex gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      <div className="glass-card p-6 lg:p-8">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 lg:mb-6 flex items-center gap-2">
          <Plus size={16} className="text-aurora-cyan" /> New document
        </h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="input-field text-sm"
              placeholder="Title e.g. Term 2 Opening Circular"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <SelectField
              label="Document type"
              icon={FileText}
              value={form.docType}
              onChange={(e) => setForm({ ...form, docType: e.target.value })}
              className="text-sm"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectField>
          </div>
          <textarea
            className="input-field min-h-[120px] lg:min-h-[160px] font-mono text-xs lg:text-sm"
            placeholder="Type the full document here..."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            required
          />
          <button type="submit" disabled={saving || !schoolId} className="btn-primary py-3 lg:py-4 px-6 lg:px-8 text-[9px] lg:text-[10px] font-black uppercase tracking-widest shadow-glow w-full sm:w-auto">
            {saving ? <Loader2 className="animate-spin inline" size={18} /> : 'Save document'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="space-y-3 lg:space-y-4">
          {loading ? (
            <div className="glass-card p-12 text-center">
              <Loader2 className="animate-spin text-aurora-cyan mx-auto" />
            </div>
          ) : documents.length === 0 ? (
            <div className="glass-card p-12 text-center border-dashed text-slate-500 text-[10px] font-black uppercase tracking-widest">
              No documents yet
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className={`glass-card p-4 lg:p-6 cursor-pointer transition-all active:scale-[0.98] ${previewDoc?.id === doc.id ? 'ring-2 ring-aurora-cyan' : ''}`}
                onClick={() => setPreviewDoc(doc)}
              >
                <div className="flex items-start justify-between gap-3 lg:gap-4">
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] lg:text-[9px] font-black text-aurora-violet uppercase tracking-widest">
                      {docTypeLabel(doc.doc_type)}
                    </span>
                    <h4 className="font-black text-white mt-1 truncate text-sm lg:text-base">{doc.title}</h4>
                    <p className="text-slate-500 text-[10px] lg:text-xs mt-1.5 lg:mt-2 line-clamp-2 whitespace-pre-wrap">{doc.body}</p>
                  </div>
                  <RowActions
                    onEdit={() => setEditDoc({ ...doc })}
                    onDelete={() => handleDelete(doc.id)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="glass-card p-6 lg:p-8 min-h-[280px] lg:min-h-[320px] print-target">
          {previewDoc ? (
            <>
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => printDocument(previewDoc)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl bg-white/10 border border-white/10 text-[9px] lg:text-[10px] font-black uppercase tracking-widest hover:bg-aurora-cyan/20 transition-all"
                >
                  <Printer size={14} lg:size={16} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => shareDocument(previewDoc)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl bg-white/10 border border-white/10 text-[9px] lg:text-[10px] font-black uppercase tracking-widest hover:bg-aurora-violet/20 transition-all"
                >
                  <Share2 size={14} lg:size={16} /> Share
                </button>
              </div>
              <h3 className="text-xl lg:text-2xl font-black text-white leading-tight">{previewDoc.title}</h3>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-2 mb-6">
                {docTypeLabel(previewDoc.doc_type)} · Updated{' '}
                {new Date(previewDoc.updated_at || previewDoc.created_at).toLocaleString()}
              </p>
              <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-xs lg:text-sm border-t border-white/10 pt-6">
                {previewDoc.body}
              </div>
            </>
          ) : (
            <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest text-center py-20">
              Select a document to preview
            </p>
          )}
        </div>
      </div>

      <EditModal
        open={!!editDoc}
        title="Edit document"
        onClose={() => setEditDoc(null)}
        onSave={handleSaveEdit}
        saving={saving}
      >
        <input
          className="input-field w-full"
          value={editDoc?.title || ''}
          onChange={(e) => setEditDoc({ ...editDoc, title: e.target.value })}
        />
        <SelectField
          label="Document type"
          value={editDoc?.doc_type || 'circular'}
          onChange={(e) => setEditDoc({ ...editDoc, doc_type: e.target.value })}
        >
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <textarea
          className="input-field w-full min-h-[200px]"
          value={editDoc?.body || ''}
          onChange={(e) => setEditDoc({ ...editDoc, body: e.target.value })}
        />
      </EditModal>
    </div>
  );
};

export default SchoolDocuments;
