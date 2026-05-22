import { Pencil, Trash2 } from 'lucide-react';

const RowActions = ({ onEdit, onDelete, deleteDisabled = false, deleteTitle = 'Delete' }) => (
  <div className="flex items-center justify-end gap-1">
    {onEdit && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="p-3 text-slate-600 hover:text-aurora-cyan hover:bg-aurora-cyan/10 rounded-xl transition-all"
        title="Edit"
      >
        <Pencil size={18} />
      </button>
    )}
    {onDelete && (
      <button
        type="button"
        disabled={deleteDisabled}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-3 text-slate-600 hover:text-aurora-rose hover:bg-aurora-rose/10 rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
        title={deleteTitle}
      >
        <Trash2 size={18} />
      </button>
    )}
  </div>
);

export default RowActions;
