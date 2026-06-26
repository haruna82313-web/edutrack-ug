import { useState, useEffect } from 'react';
import { 
  X, FileText, Printer, Share2, 
  Calendar, Download, File, FileType, 
  Users, GraduationCap, BookOpen, ArrowRight, ArrowLeft,
  Loader2
} from 'lucide-react';
import { docTypeLabel } from '../../lib/documentTypes';
import { supabase } from '../../lib/supabase';
import { 
  getOLevelGrade, 
  getPrimaryGrade, 
  calculatePrimaryAggregatesAndDivision, 
  getPrimaryGradeAggregate,
  getALevelPrincipalGradeAndPoints,
  getALevelSubsidiaryGradeAndPoints
} from '../../utils/uneb-engine';

const CircularViewerModal = ({ isOpen, onClose, doc }) => {
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [gradingConfigs, setGradingConfigs] = useState([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const isReportCard = doc?.title?.startsWith('Report Card:');

  // Helper to get ordinal suffix
  const getOrdinalSuffix = (number) => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = number % 100;
    return number + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  // Helper function to generate PDF report card (same as ClassReportCards)
  const downloadReportCardPdf = async () => {
    if (!reportData) return;
    
    setIsGeneratingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = docPdf.internal.pageSize.getWidth();
      let yPos = 10;

      // School Name
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(14);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text(reportData.school?.name || 'SCHOOL NAME', pageWidth / 2, yPos + 8, { align: 'center' });

      yPos += 14;

      // Use saved level flags from snapshot if available
      const isPrimary = reportData.is_primary ?? reportData.student?.schools?.type === 'primary';
      const isALevel = reportData.is_a_level ?? (!isPrimary && (reportData.class_name?.toLowerCase().includes('a')));
      
      // Report Title
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(13);
      const levelTitle = isPrimary ? 'PRIMARY' : (isALevel ? "A' LEVEL" : "O' LEVEL");
      docPdf.text(`${levelTitle} REPORT CARD`, pageWidth / 2, yPos, { align: 'center' });

      yPos += 6;

      // Term/Year Badge
      const accentColor = isPrimary ? [220, 38, 38] : (isALevel ? [25, 52, 124] : [34, 102, 51]);
      docPdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      docPdf.rect(pageWidth / 2 - 25, yPos - 2, 50, 5, 'F');
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.text(`${reportData.term} ${reportData.year}`, pageWidth / 2, yPos + 1, { align: 'center' });

      yPos += 14;

      // Student Info
      docPdf.setTextColor(0, 0, 0);
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.text('Student Name:', 15, yPos);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(reportData.student?.full_name || 'N/A', 50, yPos);

      docPdf.setFont('helvetica', 'bold');
      docPdf.text('Admission No.:', 120, yPos);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(reportData.student?.admission_no || 'N/A', 155, yPos);

      yPos += 6;

      docPdf.setFont('helvetica', 'bold');
      docPdf.text('Class:', 15, yPos);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(reportData.class_name || '', 50, yPos);

      docPdf.setFont('helvetica', 'bold');
      docPdf.text('Date of Birth:', 120, yPos);
      docPdf.setFont('helvetica', 'normal');
      const dob = reportData.student?.date_of_birth ? new Date(reportData.student.date_of_birth).toLocaleDateString() : 'N/A';
      docPdf.text(dob, 155, yPos);

      yPos += 6;

      docPdf.setFont('helvetica', 'bold');
      docPdf.text('Term:', 15, yPos);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(reportData.term, 50, yPos);

      docPdf.setFont('helvetica', 'bold');
      docPdf.text('Session:', 120, yPos);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text(`${reportData.year}/${parseInt(reportData.year) + 1}`, 155, yPos);

      yPos += 10;

      // Marks Table
      const tableHeaders = isPrimary
        ? [['SUBJECT', 'SCORE', 'OUT OF', 'GRADE', 'AGGREGATE', 'REMARK']]
        : (isALevel 
          ? [['SUBJECT', 'SCORE', 'OUT OF', 'GRADE', 'POINTS', 'REMARK']] 
          : [['SUBJECT', 'SCORE', 'OUT OF', 'GRADE', 'REMARK']]);

      const tableRows = (reportData.marks || []).map((m) => {
        let gradeInfo;
        if (m.grade) {
          gradeInfo = { grade: m.grade, points: m.points };
        } else if (isPrimary) {
          gradeInfo = getPrimaryGrade(m.marks, gradingConfigs, m.max_marks);
        } else if (isALevel) {
          const subjectName = m.subjects?.name || '';
          const isSubsidiary = subjectName.toUpperCase().includes('ICT') || 
                               subjectName.toUpperCase().includes('GENERAL PAPER') || 
                               subjectName.toUpperCase().includes('GP') ||
                               subjectName.toUpperCase().includes('SUB MATHS') ||
                               subjectName.toUpperCase().includes('SUB-MATHS') ||
                               subjectName.toUpperCase().includes('SUBMATHS');
          gradeInfo = isSubsidiary 
            ? getALevelSubsidiaryGradeAndPoints(m.marks, m.max_marks)
            : getALevelPrincipalGradeAndPoints(m.marks, m.max_marks);
        } else {
          gradeInfo = getOLevelGrade(m.marks, m.max_marks);
        }

        const row = [
          m.subjects?.name || 'Unknown',
          m.marks || '-',
          m.max_marks || '-',
          gradeInfo.grade
        ];

        if (isPrimary) {
          row.push(getPrimaryGradeAggregate(gradeInfo.grade));
        } else if (isALevel) {
          row.push(gradeInfo.points);
        }

        row.push(m.comments || '');
        return row;
      });

      const accentColorLight = isPrimary ? [254, 226, 226] : (isALevel ? [220, 230, 245] : [230, 245, 230]);

      autoTable(docPdf, {
        head: tableHeaders,
        body: tableRows,
        startY: yPos,
        theme: 'grid',
        margin: { left: 15, right: 15 },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0], lineColor: accentColor, lineWidth: 0.3 },
        headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: 'bold', lineWidth: 0.5 },
        alternateRowStyles: { fillColor: accentColorLight },
        bodyStyles: { lineColor: accentColor, lineWidth: 0.2 }
      });

      yPos = docPdf.lastAutoTable?.finalY || yPos + 50;

      // Summary Stats
      const safeMarksData = reportData.marks || [];
      const totalMarks = safeMarksData.reduce((sum, m) => sum + (parseFloat(m.marks) || 0), 0);
      const avgScore = safeMarksData.length > 0 ? (totalMarks / safeMarksData.length).toFixed(2) : '0.00';

      let stats;
      if (isPrimary) {
        const { totalAggregates, division } = calculatePrimaryAggregatesAndDivision(safeMarksData, gradingConfigs);
        stats = [
          { label: 'GRAND TOTAL', value: totalMarks.toFixed(0) },
          { label: 'AVERAGE SCORE', value: avgScore },
          { label: 'TOTAL AGGREGATES', value: totalAggregates },
          { label: 'DIVISION', value: division },
          { label: 'POSITION IN CLASS', value: reportData.position ? getOrdinalSuffix(reportData.position) : 'N/A' },
          { label: 'OUT OF', value: 'Students' }
        ];
      } else if (isALevel) {
        let totalPoints = 0;
        safeMarksData.forEach(m => {
          let gradeInfo;
          const subjectName = m.subjects?.name || '';
          const isSubsidiary = subjectName.toUpperCase().includes('ICT') || 
                               subjectName.toUpperCase().includes('GENERAL PAPER') || 
                               subjectName.toUpperCase().includes('GP') ||
                               subjectName.toUpperCase().includes('SUB MATHS') ||
                               subjectName.toUpperCase().includes('SUB-MATHS') ||
                               subjectName.toUpperCase().includes('SUBMATHS');
          
          if (m.grade && m.points !== undefined) {
            gradeInfo = { points: m.points };
          } else if (isSubsidiary) {
            gradeInfo = getALevelSubsidiaryGradeAndPoints(m.marks, m.max_marks);
          } else {
            gradeInfo = getALevelPrincipalGradeAndPoints(m.marks, m.max_marks);
          }
          totalPoints += gradeInfo.points || 0;
        });

        stats = [
          { label: 'GRAND TOTAL', value: totalMarks.toFixed(0) },
          { label: 'AVERAGE SCORE', value: avgScore },
          { label: 'TOTAL POINTS', value: totalPoints.toString() },
          { label: 'MAX POINTS', value: '20' },
          { label: 'POSITION IN CLASS', value: reportData.position ? getOrdinalSuffix(reportData.position) : 'N/A' },
          { label: 'OUT OF', value: 'Students' }
        ];
      } else {
        stats = [
          { label: 'GRAND TOTAL', value: totalMarks.toFixed(0) },
          { label: 'AVERAGE SCORE', value: avgScore },
          { label: 'POSITION IN CLASS', value: reportData.position ? getOrdinalSuffix(reportData.position) : 'N/A' },
          { label: 'OUT OF', value: 'Students' }
        ];
      }

      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.setTextColor(0, 0, 0);

      const colWidth = (pageWidth - 30) / 2;

      stats.forEach((stat, idx) => {
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        const xPos = 15 + col * colWidth;
        const statYPos = yPos + row * 8;

        docPdf.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
        docPdf.rect(xPos, statYPos, colWidth - 2, 7);

        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(8);
        docPdf.text(stat.label, xPos + 3, statYPos + 3);

        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(10);
        docPdf.text(String(stat.value), xPos + colWidth - 8, statYPos + 3, { align: 'right' });
      });

      yPos += 22;

      // Grade Key
      docPdf.setFillColor(accentColorLight[0], accentColorLight[1], accentColorLight[2]);
      docPdf.rect(15, yPos, pageWidth - 30, 18, 'F');

      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      docPdf.text('GRADE KEY', 20, yPos + 4);

      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(8);
      docPdf.setTextColor(0, 0, 0);
      let gradeKey;
      if (isPrimary && gradingConfigs.length > 0) {
        gradeKey = gradingConfigs.map(config => 
          `${config.grade_name}: ${config.min_score} - ${config.max_score} (${config.description})`
        );
      } else if (isALevel) {
        gradeKey = [
          'A: 6 points',
          'B: 5 points',
          'C: 4 points',
          'D: 3 points',
          'E: 2 points',
          'O: 1 point',
          'F: 0 points'
        ];
      } else {
        gradeKey = [
          'A: 80 - 100',
          'B: 70 - 79',
          'C: 50 - 69',
          'D: 40 - 49',
          'E: 0 - 39'
        ];
      }
      
      gradeKey.forEach((grade, idx) => {
        const col = idx % 3;
        const gradeColWidth = 55;
        const gradeRow = Math.floor(idx / 3);
        docPdf.text(grade, 20 + col * gradeColWidth, yPos + 8 + gradeRow * 4);
      });

      yPos += 20;

      // Attendance
      docPdf.setFillColor(accentColorLight[0], accentColorLight[1], accentColorLight[2]);
      docPdf.rect(15, yPos, pageWidth - 30, 14, 'F');

      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      docPdf.text('ATTENDANCE', 20, yPos + 4);

      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(8);
      docPdf.setTextColor(0, 0, 0);
      docPdf.text(`Present: ${reportData.attendance.present}`, 20, yPos + 9);
      docPdf.text(`Absent: ${reportData.attendance.absent}`, 70, yPos + 9);
      docPdf.text(`Rate: ${reportData.attendance.rate}%`, 120, yPos + 9);

      docPdf.setFont('helvetica', 'bold');
      docPdf.text('CONDUCT', 20, yPos + 12);
      docPdf.setFont('helvetica', 'normal');
      docPdf.text('Excellent', 50, yPos + 12);

      yPos += 16;

      // Comment
      docPdf.setFillColor(accentColorLight[0], accentColorLight[1], accentColorLight[2]);
      docPdf.rect(15, yPos, pageWidth - 30, 20, 'F');

      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9);
      docPdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      docPdf.text("CLASS TEACHER'S COMMENT", 20, yPos + 4);

      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(8);
      docPdf.setTextColor(0, 0, 0);

      const hasSubjectComments = (reportData.marks || []).some(m => m.comments);
      let comment;

      if (hasSubjectComments) {
        const subjectComments = (reportData.marks || []).filter(m => m.comments).map(m => m.comments);
        comment = `${reportData.student?.full_name}: ${subjectComments.join(' ')}`;
      } else {
        comment = `${reportData.student?.full_name} demonstrates excellent understanding of concepts and shows great commitment to studies.`;
      }

      docPdf.text(comment, 20, yPos + 9, { maxWidth: pageWidth - 40, align: 'left' });

      // Download the PDF
      const filename = `${reportData.student?.full_name?.replace(/\s+/g, '_') || 'Student'}_${reportData.term}_${reportData.year}_Report_Card.pdf`;
      docPdf.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // If it's a report card, fetch student data
  useEffect(() => {
    if (isReportCard && isOpen && doc) {
      loadReportCardData();
    }
  }, [isReportCard, isOpen, doc]);

  const loadReportCardData = async () => {
    setLoadingReport(true);
    try {
      // Check if body contains JSON snapshot (new format)
      if (doc.body) {
        try {
          const parsed = JSON.parse(doc.body);
          // If it has marks, it's a snapshot!
          if (parsed.marks || (parsed.student && parsed.term)) {
            setReportData(parsed);
            
            // Use saved grading configs from snapshot if available, otherwise fetch
            if (parsed.grading_configs) {
              setGradingConfigs(parsed.grading_configs);
            } else if (parsed.school?.id) {
              const { data: configData } = await supabase
                .from('grading_configs')
                .select('*')
                .eq('school_id', parsed.school.id)
                .order('min_score', { ascending: false });
              if (configData) setGradingConfigs(configData);
            }
            
            setLoadingReport(false);
            return;
          }
        } catch (parseErr) {
          // Not JSON, fall through to old logic
        }
      }

      // Fallback: reconstruct from database (for old format)
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
          .select('*, classes(*), schools(*)')
          .eq('id', doc.student_id)
          .single();
        student = studentData;
      } else {
        // Try to find by name from title
        const studentNameInTitle = doc.title?.replace('Report Card: ', '');
        if (studentNameInTitle) {
          const { data: studentsData } = await supabase
            .from('students')
            .select('*, classes(*), schools(*)')
            .eq('full_name', studentNameInTitle);
          if (studentsData && studentsData.length > 0) {
            student = studentsData[0];
          }
        }
      }

      if (student) {
        data.student = student;
        data.class_name = student.classes?.name || data.class_name;
        data.school = student.schools || null;

        // Fetch grading configs for primary schools
        if (student.schools?.type === 'primary' && student.school_id) {
          const { data: configData } = await supabase
            .from('grading_configs')
            .select('*')
            .eq('school_id', student.school_id)
            .order('min_score', { ascending: false });
          if (configData) setGradingConfigs(configData);
        }

        // Fetch marks for the student
        // Try exact term/year first
        let { data: marks } = await supabase
          .from('student_marks')
          .select('*, subjects(name)')
          .eq('student_id', student.id)
          .eq('year', parseInt(data.year))
          .eq('term', data.term);
        
        // If no marks found, get all published marks for the student
        if (!marks || marks.length === 0) {
          const { data: allMarks } = await supabase
            .from('student_marks')
            .select('*, subjects(name)')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false })
            .limit(50);
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
                  studentAverages[classmate.id] = total / classmateMarks.length;
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
      if (doc.school_id && !data.school) {
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
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
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
                        <p className="text-[9px] font-black text-aurora-amber">Position: #{getOrdinalSuffix(reportData.position)}</p>
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
                              // Determine grading system
                              const isPrimary = reportData.student?.schools?.type === 'primary';
                              const isALevel = !isPrimary && (reportData.class_name?.toLowerCase().includes('a'));
                              
                              let gradeInfo;
                              if (m.grade) {
                                gradeInfo = { grade: m.grade, points: m.points };
                              } else if (isPrimary) {
                                gradeInfo = getPrimaryGrade(m.marks, gradingConfigs, m.max_marks);
                              } else if (isALevel) {
                                const subjectName = m.subjects?.name || '';
                                const isSubsidiary = subjectName.toUpperCase().includes('ICT') || 
                                                     subjectName.toUpperCase().includes('GENERAL PAPER') || 
                                                     subjectName.toUpperCase().includes('GP') ||
                                                     subjectName.toUpperCase().includes('SUB MATHS') ||
                                                     subjectName.toUpperCase().includes('SUB-MATHS') ||
                                                     subjectName.toUpperCase().includes('SUBMATHS');
                                gradeInfo = isSubsidiary 
                                  ? getALevelSubsidiaryGradeAndPoints(m.marks, m.max_marks)
                                  : getALevelPrincipalGradeAndPoints(m.marks, m.max_marks);
                              } else {
                                gradeInfo = getOLevelGrade(m.marks, m.max_marks);
                              }
                              
                              const getGradeColor = () => {
                                if (isPrimary) {
                                  switch (gradeInfo.grade) {
                                    case '1': return 'text-aurora-emerald bg-aurora-emerald/10 border border-aurora-emerald/20';
                                    case '2': return 'text-aurora-cyan bg-aurora-cyan/10 border border-aurora-cyan/20';
                                    case '3': return 'text-aurora-amber bg-aurora-amber/10 border border-aurora-amber/20';
                                    default: return 'text-aurora-rose bg-aurora-rose/10 border border-aurora-rose/20';
                                  }
                                } else {
                                  switch (gradeInfo.grade) {
                                    case 'A': return 'text-aurora-emerald bg-aurora-emerald/10 border border-aurora-emerald/20';
                                    case 'B': return 'text-aurora-cyan bg-aurora-cyan/10 border border-aurora-cyan/20';
                                    case 'C': return 'text-aurora-amber bg-aurora-amber/10 border border-aurora-amber/20';
                                    default: return 'text-aurora-rose bg-aurora-rose/10 border border-aurora-rose/20';
                                  }
                                }
                              };
                              return (
                                <tr key={idx} className="hover:bg-white/5">
                                  <td className="py-3 px-3 font-bold text-slate-200 text-[12px]">{m.subjects?.name || 'Unknown'}</td>
                                  <td className="py-3 px-3 text-center font-black text-lg text-aurora-cyan">{m.marks}</td>
                                  <td className="py-3 px-3 text-center text-slate-500 font-bold">{m.max_marks}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-widest ${getGradeColor()}`}>
                                      {gradeInfo.grade}
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
            {isReportCard && reportData && (
              <button 
                onClick={downloadReportCardPdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 px-4 py-2.5 bg-aurora-cyan/20 hover:bg-aurora-cyan/30 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all text-aurora-cyan border border-aurora-cyan/20 disabled:opacity-50"
              >
                {isGeneratingPdf ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
              </button>
            )}
            {doc.file_url && (
              <button 
                onClick={() => downloadFile(doc)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all text-emerald-400 border border-emerald-500/20"
              >
                <Download size={12} />
                Download File
              </button>
            )}
            <button 
              onClick={printDocument}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all text-white shadow-glow"
            >
              <Printer size={12} />
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularViewerModal;
