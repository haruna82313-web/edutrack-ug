export const EXPORT_DATASETS = [
  { id: 'students', label: 'Students' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'classes', label: 'Classes' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'lessons', label: 'Lessons' },
  { id: 'attendance', label: 'Attendance (today)' },
  { id: 'syllabus', label: 'Syllabus topics' },
];

function escapeCsvCell(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcelCsv(filename, headers, rows) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(`${filename}.csv`, blob);
}

export async function exportToExcel(filename, headers, rows) {
  try {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch {
    exportToExcelCsv(filename, headers, rows);
    alert('Excel library loading — saved as .csv instead (opens in Excel). Run npm install in the project folder for .xlsx files.');
  }
}

export function exportToPdfPrint(title, headers, rows) {
  const tableRows = rows
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td style="border:1px solid #ccc;padding:6px;">${String(c ?? '').replace(/</g, '&lt;')}</td>`).join('')}</tr>`
    )
    .join('');
  const head = headers.map((h) => `<th style="border:1px solid #ccc;padding:8px;background:#eee;">${h}</th>`).join('');
  const win = window.open('', '_blank');
  if (!win) {
    alert('Allow pop-ups to export PDF.');
    return;
  }
  win.document.write(`
    <!DOCTYPE html><html><head><title>${title}</title></head><body>
    <h2>${title}</h2><p style="font-size:12px;color:#666;">${new Date().toLocaleString()}</p>
    <table style="border-collapse:collapse;width:100%;font-size:12px;"><thead><tr>${head}</tr></thead><tbody>${tableRows}</tbody></table>
    <script>window.onload=function(){window.print();}</script></body></html>
  `);
  win.document.close();
}

export async function exportToPdf(title, headers, rows, filename) {
  try {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: rows.length > 8 ? 'landscape' : 'portrait' });
    doc.setFontSize(16);
    doc.text(title, 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 26);
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [34, 211, 238] },
    });
    doc.save(`${filename}.pdf`);
  } catch {
    exportToPdfPrint(title, headers, rows);
  }
}
