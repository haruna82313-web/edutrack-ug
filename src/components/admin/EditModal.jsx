import { X, Loader2, Save } from 'lucide-react';

/**
 * @param {{ open: boolean, title: string, onClose: () => void, onSave: () => void, saving?: boolean, children: import('react').ReactNode }} props
 */
const EditModal = ({ open, title, onClose, onSave, saving = false, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-aurora-navy/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative glass-card w-full max-w-lg p-8 space-y-6 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-white uppercase tracking-widest text-sm">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-primary flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> Save changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
