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
  Search,
  Upload,
  X,
  Download,
  File,
  FileType,
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
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [form, setForm] = useState({ title: '', docType: 'circular', body: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const filteredDocs = documents.filter(doc => {
    const query = searchQuery.toLowerCase();
    return (
      doc.title?.toLowerCase().includes(query) ||
      doc.body?.toLowerCase().includes(query) ||
      docTypeLabel(doc.doc_type).toLowerCase().includes(query)
    );
  });

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

  const resetForm = () => {
    setForm({ title: '', docType: 'circular', body: '' });
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
  };

  const uploadFile = async (file, schoolId) => {
    try {
      setUploading(true);
      setUploadProgress(0);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${schoolId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('school-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(100);

      const { data: { publicUrl } } = supabase.storage
        .from('school-documents')
        .getPublicUrl(filePath);

      return {
        file_url: publicUrl,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      };
    } catch (err) {
      console.warn('File upload skipped (school-documents storage bucket not set up yet):', err.message);
      // If upload fails, ask user if they want to save without the file
      const confirmSaveWithoutFile = window.confirm(
        `File upload skipped (storage not set up yet).\n\nDo you want to save the document without the file?`
      );
      if (confirmSaveWithoutFile) {
        return {}; // Return empty object to save without file
      }
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    try {
      let fileData = {};
      
      if (selectedFile) {
        fileData = await uploadFile(selectedFile, schoolId);
      }

      const { error: err } = await supabase.from('school_documents').insert([
        {
          school_id: schoolId,
          title: form.title.trim(),
          doc_type: form.docType,
          body: form.body,
          ...fileData,
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

  const handleDelete = async (doc) => {
    if (!confirm('Delete this document permanently?')) return;
    try {
      // Try to delete the file first, but don't fail the whole operation if file deletion fails
      if (doc.file_path) {
        try {
          await supabase.storage
            .from('school-documents')
            .remove([doc.file_path]);
        } catch (fileErr) {
          console.warn('File deletion skipped (storage may not be set up):', fileErr.message);
          // Continue to delete the document even if file deletion fails
        }
      }
      await deleteSchoolDocument(doc.id);
      if (previewDoc?.id === doc.id) setPreviewDoc(null);
      fetchDocs(schoolId);
    } catch (err) {
      alert(err.message);
    }
  };

  const downloadFile = (doc) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return <FileText size={16} />;
    if (fileType?.includes('image')) return <FileType size={16} />;
    return <File size={16} />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black tracking-tighter uppercase flex items-center gap-3">
            <FileText className="text-aurora-cyan" /> School documents
          </h2>
          <p className="text-slate-400 mt-2 text-sm">
            Type circulars and notices. Print or share between devices.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search documents..."
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all w-full sm:w-64 lg:w-80 shadow-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={18} />
          </div>
          <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800 self-start">
            <FileText className="text-primary-400" size={18} />
            <span className="text-xs lg:text-sm font-bold text-slate-300">
              {searchQuery ? `${filteredDocs.length} Found` : `${documents.length} Total`}
            </span>
          </div>
        </div>
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
            placeholder="Type the full document here (optional if uploading a file)..."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />

          {/* File Upload Area */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Upload size={12} /> Attach File (PDF, Docs, Images, etc.)
            </label>
            
            {!selectedFile ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-2xl cursor-pointer bg-slate-950 hover:bg-slate-900 hover:border-primary-500/50 transition-all">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-slate-500" />
                  <p className="text-sm font-bold text-slate-400">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-600 mt-1">PDF, DOC, DOCX, PNG, JPG (Max 10MB)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls"
                />
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
                    {getFileIcon(selectedFile.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedFile}
                  className="p-2 text-slate-400 hover:text-aurora-rose hover:bg-aurora-rose/10 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={saving || uploading || !schoolId} 
            className="btn-primary py-3 lg:py-4 px-6 lg:px-8 text-[9px] lg:text-[10px] font-black uppercase tracking-widest shadow-glow w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {saving || uploading ? (
              <>
                <Loader2 className="animate-spin" size={18} /> 
                {uploading ? 'Uploading...' : 'Saving...'}
              </>
            ) : 'Save document'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="space-y-3 lg:space-y-4">
          {loading ? (
            <div className="glass-card p-12 text-center">
              <Loader2 className="animate-spin text-aurora-cyan mx-auto" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="glass-card p-12 text-center border-dashed text-slate-500 text-[10px] font-black uppercase tracking-widest">
              {searchQuery ? 'No matching documents' : 'No documents yet'}
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className={`glass-card p-4 lg:p-6 cursor-pointer transition-all active:scale-[0.98] ${previewDoc?.id === doc.id ? 'ring-2 ring-aurora-cyan' : ''}`}
                onClick={() => setPreviewDoc(doc)}
              >
                <div className="flex items-start justify-between gap-3 lg:gap-4">
                  <div className="w-8 h-8 bg-primary-600/10 text-primary-400 rounded-lg flex items-center justify-center border border-primary-500/10 shrink-0 mt-1">
                    {doc.file_url ? getFileIcon(doc.file_type) : <FileText size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] lg:text-[9px] font-black text-aurora-violet uppercase tracking-widest">
                        {docTypeLabel(doc.doc_type)}
                      </span>
                      {doc.file_url && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-widest border bg-aurora-cyan/10 text-aurora-cyan border-aurora-cyan/20">
                          Attachment
                        </span>
                      )}
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-widest border ${
                        ['circular', 'notice'].includes(doc.doc_type) 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}>
                        {['circular', 'notice'].includes(doc.doc_type) ? 'Parent Portal Sync' : 'Internal Only'}
                      </span>
                    </div>
                    <h4 className="font-black text-white truncate text-sm lg:text-base">{doc.title}</h4>
                    {doc.body && (
                      <p className="text-slate-500 text-[10px] lg:text-xs mt-1.5 lg:mt-2 line-clamp-2 whitespace-pre-wrap">{doc.body}</p>
                    )}
                    {doc.file_url && (
                      <div className="flex items-center gap-2 mt-1.5 lg:mt-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-aurora-cyan font-bold">
                          <FileText size={12} />
                          <span className="truncate">{doc.file_name}</span>
                        </div>
                        {doc.file_size && (
                          <span className="text-[8px] text-slate-600">({formatFileSize(doc.file_size)})</span>
                        )}
                      </div>
                    )}
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-2">
                      {new Date(doc.updated_at || doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <RowActions
                    onEdit={() => setEditDoc({ ...doc })}
                    onDelete={() => handleDelete(doc)}
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
                {previewDoc.file_url && (
                  <button
                    type="button"
                    onClick={() => downloadFile(previewDoc)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 lg:px-5 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-[9px] lg:text-[10px] font-black uppercase tracking-widest"
                  >
                    <Download size={14} lg:size={16} /> Download
                  </button>
                )}
              </div>
              <h3 className="text-xl lg:text-2xl font-black text-white leading-tight">{previewDoc.title}</h3>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-2 mb-6">
                {docTypeLabel(previewDoc.doc_type)} · Updated{' '}
                {new Date(previewDoc.updated_at || previewDoc.created_at).toLocaleString()}
              </p>

              {/* File Attachment Preview */}
              {previewDoc.file_url && (
                <div className="mb-6 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
                      {getFileIcon(previewDoc.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{previewDoc.file_name}</p>
                      {previewDoc.file_size && (
                        <p className="text-xs text-slate-500">{formatFileSize(previewDoc.file_size)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => downloadFile(previewDoc)}
                      className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-500 transition-all"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                  {/* PDF Preview */}
                  {previewDoc.file_type?.includes('pdf') && (
                    <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden bg-white">
                      <iframe
                        src={previewDoc.file_url}
                        className="w-full h-80"
                        title="PDF Preview"
                      />
                    </div>
                  )}
                  {/* Image Preview */}
                  {previewDoc.file_type?.includes('image') && (
                    <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden">
                      <img
                        src={previewDoc.file_url}
                        alt={previewDoc.file_name}
                        className="w-full max-h-80 object-contain bg-slate-900"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Text Content */}
              {previewDoc.body && (
                <div className="text-slate-300 whitespace-pre-wrap leading-relaxed text-xs lg:text-sm border-t border-white/10 pt-6">
                  {previewDoc.body}
                </div>
              )}
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
