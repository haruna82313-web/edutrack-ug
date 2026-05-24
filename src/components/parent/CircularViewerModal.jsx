import { 
  X, FileText, Printer, Share2, 
  Calendar, CheckCircle2 
} from 'lucide-react';
import { docTypeLabel } from '../../lib/documentTypes';

const CircularViewerModal = ({ isOpen, onClose, doc }) => {
  if (!isOpen || !doc) return null;

  const printDocument = () => {
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
      <p class="meta">${docTypeLabel(doc.doc_type)} · ${new Date(doc.updated_at || doc.created_at).toLocaleString()}</p>
      <div class="body">${doc.body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      <script>window.onload = () => { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  };

  const shareDocument = async () => {
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
      alert('Document copied. Paste into WhatsApp or Email to share.');
    } catch {
      alert('Copy failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-aurora-amber/10 rounded-xl flex items-center justify-center text-aurora-amber border border-aurora-amber/20">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight truncate max-w-[200px]">{doc.title}</h2>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                {docTypeLabel(doc.doc_type)} · {new Date(doc.updated_at || doc.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={shareDocument} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all">
              <Share2 size={18} />
            </button>
            <button onClick={onClose} className="p-2.5 text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <div className="whitespace-pre-wrap text-slate-300 font-medium leading-relaxed text-sm sm:text-base">
            {doc.body}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-primary-500" />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Published by Administration</span>
          </div>
          <button 
            onClick={printDocument}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-white shadow-glow"
          >
            <Printer size={14} /> Print Document
          </button>
        </div>
      </div>
    </div>
  );
};

export default CircularViewerModal;
