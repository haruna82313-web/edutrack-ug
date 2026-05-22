import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, FileText, Loader2, Download, ChevronLeft } from 'lucide-react';
import { EXPORT_DATASETS, exportToExcel, exportToPdf } from '../../lib/exportUtils';
import { fetchDataset } from '../../lib/fetchExportData';

const DataExport = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialFormat = searchParams.get('format') === 'excel' ? 'excel' : 'pdf';
  const [format, setFormat] = useState(initialFormat);

  useEffect(() => {
    setFormat(searchParams.get('format') === 'excel' ? 'excel' : 'pdf');
  }, [searchParams]);
  const [dataset, setDataset] = useState('students');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const runExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const { title, headers, rows } = await fetchDataset(dataset);
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `edutrack-${dataset}-${stamp}`;

      if (format === 'excel') {
        await exportToExcel(filename, headers, rows);
      } else {
        await exportToPdf(title, headers, rows, filename);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-white">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-aurora-cyan font-black text-[10px] uppercase tracking-widest hover:gap-3 transition-all"
      >
        <ChevronLeft size={16} /> Back to hub
      </button>

      <div>
        <h2 className="text-2xl lg:text-3xl font-black tracking-tighter uppercase">
          {format === 'excel' ? 'Export to Excel' : 'Export to PDF'}
        </h2>
        <p className="text-slate-400 mt-2 text-sm font-medium">
          Download school records for printing or sharing offline.
        </p>
      </div>

      <div className="glass-card p-8 space-y-8 max-w-xl">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setFormat('pdf')}
            className={`flex-1 py-4 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              format === 'pdf'
                ? 'border-aurora-cyan text-aurora-cyan bg-aurora-cyan/10'
                : 'border-white/10 text-slate-500'
            }`}
          >
            <FileText size={18} /> PDF
          </button>
          <button
            type="button"
            onClick={() => setFormat('excel')}
            className={`flex-1 py-4 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              format === 'excel'
                ? 'border-aurora-emerald text-aurora-emerald bg-aurora-emerald/10'
                : 'border-white/10 text-slate-500'
            }`}
          >
            <FileSpreadsheet size={18} /> Excel
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data to export</label>
          <select
            className="input-field w-full appearance-none"
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
          >
            {EXPORT_DATASETS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-aurora-rose text-[10px] font-black uppercase tracking-widest">{error}</p>
        )}

        <button
          type="button"
          disabled={exporting}
          onClick={runExport}
          className="btn-primary w-full py-5 text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2"
        >
          {exporting ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              <Download size={18} /> Download {format === 'excel' ? '.xlsx' : '.pdf'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DataExport;
