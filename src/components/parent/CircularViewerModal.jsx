import { useState, useEffect } from 'react';
import { 
  X, FileText, Printer, Share2, 
  Calendar, Download, File, FileType, 
  Users, GraduationCap, BookOpen, ArrowRight, ArrowLeft,
  Loader2
} from 'lucide-react';
import { docTypeLabel } from '../../lib/documentTypes';
import { supabase } from '../../lib/supabase';
import { getOLevelGrade } from '../../utils/uneb-engine';

const CircularViewerModal = ({ isOpen, onClose, doc }) => {
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const isReportCard = doc?.title?.startsWith('Report Card:');

  // If it's a report card, fetch student data
  useEffect(() => {
    if (isReportCard && isOpen && doc) {
      loadReportCardData();
    }
  }, [isReportCard, isOpen, doc]);

  const loadReportCardData = async () => {
    setLoadingReport(true);
    try {
      const data = {
        student: null,
        marks: [],
        attendance: { present: 0, absent: 0, rate: 0, total: 0 },
        school: null,
        term: 'Term 1',
        year: new Date().getFullYear().toString(),
        class_name: null
      };

      // Try to parse term and year from doc
      if (doc.body) {
        const termMatch = doc.body.match(/(Term \d+)/);
        const yearMatch = doc.body.match(/(\d{4})/);
        if (termMatch) data.term = termMatch[1];
        if (yearMatch) data.year = yearMatch[1];
      }
      if (doc.term) data.term = doc.term;
      if (doc.year) data.year = doc.year.toString();
      if (doc.class_name) data.class_name = doc.class_name;

      // Try to find the student
      let student = null;
      if (doc.student_id) {
        const { data: studentData } = await supabase
          .from('students')
          .select('*, classes(name)')
          .eq('id', doc.student_id)
          .single();
        student = studentData;
      } else {
        // Try to find by name from title
        const studentNameInTitle = doc.title?.replace('Report Card: ', '');
        if (studentNameInTitle) {
          const { data: studentsData } = await supabase
            .from('students')
            .select('*, classes(name)')
            .eq('full_name', studentNameInTitle);
          if (studentsData && studentsData.length > 0) {
            student = studentsData[0];
          }
        }
      }

      if (student) {
        data.student = student;
        data.class_name = student.classes?.name || data.class_name;

        // Fetch marks for the student
        let marksQuery = supabase
          .from('student_marks')
          .select('*, subjects(name)')
          .eq('student_id', student.id);
        
        // Try exact term/year first
        let { data: marks } = await marksQuery
          .eq('year', parseInt(data.year))
          .eq('term', data.term);
        
        // If no marks found, get all marks for the student
        if (!marks || marks.length === 0) {
          const { data: allMarks } = await supabase
            .from('student_marks')
            .select('*, subjects(name)')
            .eq('student_id', student.id);
          marks = allMarks;
        }
        data.marks = marks || [];

        // Calculate position if we have class id
        let position = null;
        if (student.class_id) {
          const { data: classmates } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', student.class_id);
          if (classmates && classmates.length > 0 && data.marks.length > 0) {
            // Calculate student averages for position
            const studentAverages = {};
            const studentIds = classmates.map(s => s.id);
            const { data: classMarks } = await supabase
              .from('student_marks')
              .select('*, students(id)')
              .in('student_id', studentIds);
            
            if (classMarks && classMarks.length > 0) {
              classmates.forEach(classmate => {
                const classmateMarks = classMarks.filter(m => m.student_id === classmate.id);
                if (classmateMarks.length > 0) {
                  const total = classmateMarks.reduce((sum, m) => sum + (m.marks / m.max_marks * 100), 0);
                  studentAverages[classmate.id] = total / classMarks.length;
                } else {
                  studentAverages[classmate.id] = 0;
                }
              });
              const sortedIds = [...classmates].sort((a, b) => studentAverages[b.id] - studentAverages[a.id]).map(s => s.id);
              const posIndex = sortedIds.indexOf(student.id);
              position = posIndex >= 0 ? posIndex + 1 : null;
            }
          }
        }
        data.position = position;

        // Fetch attendance
        const startDate = `${data.year}-01-01`;
        const endDate = `${data.year}-12-31`;
        const { data: attData } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', student.id)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        const total = attData?.length || 0;
        const present = attData?.filter(a => a.status === 'present').length || 0;
        const absent = total - present;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        data.attendance = { present, absent, rate, total };
      }

      // Fetch school info (if we can)
      if (doc.school_id) {
        const { data: school } = await supabase
          .from('schools')
          .select('*')
          .eq('id', doc.school_id)
          .single();
        data.school = school;
      }

      setReportData(data);
    } catch (err) {
      console.error('Error loading report card:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const downloadFile = (doc) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return <FileText size={20} />;
    if (fileType?.includes('image')) return <FileType size={20} />;
    return <File size={20} />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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
      <p class="meta">${docTypeLabel(doc.doc_type)} · ${new Date(doc.updated_at || doc.created_at).toLocaleDateString()}</p>
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

  if (!isOpen || !doc) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isReportCard ? 'bg-primary-600/20 text-primary-400 border-primary-500/20' : 'bg-aurora-amber/10 text-aurora-amber border-aurora-amber/20'}`}>
              {isReportCard ? <GraduationCap size={20} /> : (doc.file_url ? getFileIcon(doc.file_type) : <FileText size={20} />)}
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight truncate max-w-[200px]">{doc.title}</h2>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                {docTypeLabel(doc.doc_type)} · {new Date(doc.updated_at || doc.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {doc.file_url && (
              <button onClick={() => downloadFile(doc)} className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-emerald-400 hover:text-emerald-300 transition-all border border-emerald-500/20">
                <Download size={18} />
              </button>
            )}
            <button onClick={shareDocument} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all">
              <Share2 size={18} />
            </button>
            <button onClick={onClose} className="p-2.5 text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar">
          {/* If it's a report card, show the beautiful report card UI */}
          {isReportCard ? (
            <div className="space-y-6">
              {loadingReport ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-primary-400" />
                </div>
              ) : reportData ? (
                <>
                  {/* School & Student Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      {reportData.school?.logo_url && (
                        <img src={reportData.school.logo_url} alt="School Logo" className="w-14 h-14 object-contain rounded-lg" />
                      )}
                      <h4 className="text-base sm:text-lg font-black text-aurora-cyan tracking-tight">{reportData.school?.name || 'School Name'}</h4>
                      <p className="text-[9px] sm:text-xs font-bold text-slate-400">{reportData.school?.address || 'School Address'}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Student</p>
                      <p className="text-sm sm:text-base font-black text-white">{reportData.student?.full_name || 'Student Name'}</p>
                      {reportData.position && (
                        <p className="text-[9px] font-black text-aurora-amber">Position: #{reportData.position}</p>
                      )}
                      <p className="text-[9px] sm:text-xs font-bold text-slate-400">{reportData.class_name || 'Class'}</p>
                      <p className="text-[9px] sm:text-xs font-bold text-slate-400">{reportData.term} {reportData.year}</p>
                    </div>
                  </div>

                  {/* Marks Table */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen size={14} className="text-aurora-violet" />
                      <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Academic Performance</h4>
                    </div>
                    {reportData.marks.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950">
                              <th className="py-2.5 px-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Subject</th>
                              <th className="py-2.5 px-3 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Marks</th>
                              <th className="py-2.5 px-3 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Max</th>
                              <th className="py-2.5 px-3 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Grade</th>
                              <th className="py-2.5 px-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Comment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {reportData.marks.map((m, idx) => {
                              const { grade } = getOLevelGrade(m.marks, m.max_marks);
                              const getGradeColor = () => {
                                switch (grade) {
                                  case 'A': return 'text-aurora-emerald bg-aurora-emerald/10 border border-aurora-emerald/20';
                                  case 'B': return 'text-aurora-cyan bg-aurora-cyan/10 border border-aurora-cyan/20';
                                  case 'C': return 'text-aurora-amber bg-aurora-amber/10 border border-aurora-amber/20';
                                  default: return 'text-aurora-rose bg-aurora-rose/10 border border-aurora-rose/20';
                                }
                              };
                              return (
                                <tr key={idx} className="hover:bg-white/5">
                                  <td className="py-3 px-3 font-bold text-slate-200 text-[12px]">{m.subjects?.name || 'Unknown'}</td>
                                  <td className="py-3 px-3 text-center font-black text-lg text-aurora-cyan">{m.marks}</td>
                                  <td className="py-3 px-3 text-center text-slate-500 font-bold">{m.max_marks}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-widest ${getGradeColor()}`}>
                                      {grade}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-[9px] text-slate-400">{m.comments || ''}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl">
                        <p className="text-slate-600 font-bold text-[9px] uppercase tracking-widest">No marks recorded for this term</p>
                      </div>
                    )}
                  </div>

                  {/* Attendance Summary */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={14} className="text-aurora-emerald" />
                      <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Attendance Summary</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <div className="bg-aurora-emerald/10 border border-aurora-emerald/20 p-3 sm:p-4 rounded-2xl text-center">
                        <p className="text-2xl sm:text-3xl font-black text-aurora-emerald">{reportData.attendance.present}</p>
                        <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest">Present</p>
                      </div>
                      <div className="bg-aurora-rose/10 border border-aurora-rose/20 p-3 sm:p-4 rounded-2xl text-center">
                        <p className="text-2xl sm:text-3xl font-black text-aurora-rose">{reportData.attendance.absent}</p>
                        <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest">Absent</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-3 sm:p-4 rounded-2xl text-center">
                        <p className="text-2xl sm:text-3xl font-black text-slate-200">{reportData.attendance.rate}%</p>
                        <p className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest">Attendance</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="whitespace-pre-wrap text-slate-300 font-medium leading-relaxed text-sm sm:text-base">
                  {doc.body}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* File Attachment Preview */}
              {doc.file_url && (
                <div className="mb-6 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
                      {getFileIcon(doc.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{doc.file_name}</p>
                      {doc.file_size && (
                        <p className="text-xs text-slate-500">{formatFileSize(doc.file_size)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => downloadFile(doc)}
                      className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-500 transition-all"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                  {/* PDF Preview */}
                  {doc.file_type?.includes('pdf') && (
                    <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden bg-white">
                      <iframe
                        src={doc.file_url}
                        className="w-full h-80"
                        title="PDF Preview"
                      />
                    </div>
                  )}
                  {/* Image Preview */}
                  {doc.file_type?.includes('image') && (
                    <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden">
                      <img
                        src={doc.file_url}
                        alt={doc.file_name}
                        className="w-full max-h-80 object-contain bg-slate-900"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Text Content */}
              {doc.body && (
                <div className="whitespace-pre-wrap text-slate-300 font-medium leading-relaxed text-sm sm:text-base">
                  {doc.body}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-primary-500" />
            <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest">Published by Administration</span>
          </div>
          <div className="flex items-center gap-2">
            {doc.file_url && (
              <button 
                onClick={() => downloadFile(doc)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all text-emerald-400 border border-emerald-500/20"
              >
                <Download size={12} sm:size={14} /> Download
              </button>
            )}
            <button 
              onClick={printDocument}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all text-white shadow-glow"
            >
              <Printer size={12} sm:size={14} /> Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularViewerModal;
