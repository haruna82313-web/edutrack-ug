import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  ChevronLeft, Users, Calendar, Download, Share2, Send, 
  Loader2, FileText, GraduationCap, BookOpen, Star,
  ArrowRight, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { 
  calculateOLevelTotal, getOLevelGrade,
  calculateTotalALevelPoints, getALevelPrincipalGradeAndPoints
} from '../../utils/uneb-engine';
import { exportToPdf } from '../../lib/exportUtils';

const TERMS = [
  { value: 'Term 1', label: 'Term 1' },
  { value: 'Term 2', label: 'Term 2' },
  { value: 'Term 3', label: 'Term 3' }
];

const ClassReportCards = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  // State
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingAll, setSendingAll] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [allMarks, setAllMarks] = useState([]);
  const [studentPositions, setStudentPositions] = useState({});

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get class info
      const { data: cls, error: clsErr } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();
      if (clsErr) throw clsErr;
      setClassInfo(cls);

      // 2. Get students
      const { data: stds, error: stdsErr } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('full_name');
      if (stdsErr) throw stdsErr;
      setStudents(stds || []);
      if (stds?.length > 0) setSelectedStudent(stds[0]);

      // 3. Get all marks for class to calculate positions
      if (stds?.length > 0) {
        const studentIds = stds.map(s => s.id);
        const { data: marksData, error: marksErr } = await supabase
          .from('student_marks')
          .select('*, students(id)')
          .in('student_id', studentIds)
          .eq('year', parseInt(selectedYear))
          .eq('term', selectedTerm);
        if (!marksErr && marksData) {
          setAllMarks(marksData);
          // Calculate positions based on average marks
          const studentAverages = {};
          stds.forEach(student => {
            const studentMarks = marksData.filter(m => m.student_id === student.id);
            if (studentMarks.length > 0) {
              const total = studentMarks.reduce((sum, m) => sum + (m.marks / m.max_marks * 100), 0);
              studentAverages[student.id] = total / studentMarks.length;
            } else {
              studentAverages[student.id] = 0;
            }
          });
          // Sort students by average
          const sortedStudentIds = [...stds].sort((a, b) => studentAverages[b.id] - studentAverages[a.id]).map(s => s.id);
          const positions = {};
          sortedStudentIds.forEach((id, index) => positions[id] = index + 1);
          setStudentPositions(positions);
        }
      }

      // 4. Get school info
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        const { data: profile } = await supabase
          .from('users')
          .select('school_id')
          .eq('id', user.user.id)
          .single();
        if (profile?.school_id) {
          const { data: school } = await supabase
            .from('schools')
            .select('*')
            .eq('id', profile.school_id)
            .single();
          setSchoolInfo(school);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Failed to load data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [classId, selectedYear, selectedTerm, showNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get student's marks for selected term/year
  const getStudentMarks = (studentId) => {
    return supabase
      .from('student_marks')
      .select(`*, subjects(name)`)
      .eq('student_id', studentId)
      .eq('year', parseInt(selectedYear))
      .eq('term', selectedTerm);
  };

  // Download individual report card
  const downloadReport = async (student) => {
    const { data: marksData } = await getStudentMarks(student.id);

    // Get attendance summary for this student
    let attendanceData = { present: 0, absent: 0, rate: 0 };
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
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
      attendanceData = { present, absent, rate };
    } catch (err) {
      console.warn('Could not fetch attendance data');
    }

    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait' });

      // Header with school info
      doc.setFillColor(10, 14, 39); // Dark blue
      doc.roundedRect(10, 10, 190, 50, 5, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(schoolInfo?.name || 'SCHOOL NAME', 105, 30, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(schoolInfo?.address || 'School Address', 105, 40, { align: 'center' });

      // Student info section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORT CARD', 105, 70, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Student Name:', 15, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(student.full_name, 60, 85);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Class:', 125, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(classInfo?.name || '', 95, 85);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Term/Year:', 125, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`${selectedTerm} ${selectedYear}`, 160, 100);

      // Position if available
      if (studentPositions[student.id]) {
        doc.setFont('helvetica', 'bold');
        doc.text('Position:', 125, 115);
        doc.setFont('helvetica', 'normal');
        doc.text(`#${studentPositions[student.id]} / ${students.length}`, 160, 115);
      }

      // Marks table
      const tableHeaders = [['Subject', 'Marks Obtained', 'Max Marks', 'Grade', 'Comment']];
      const tableRows = (marksData || []).map(m => {
        const grade = getOLevelGrade(m.marks, m.max_marks).grade;
        return [
          m.subjects?.name || 'Unknown',
          m.marks,
          m.max_marks,
          grade,
          m.comments || grade === 'A' ? 'Excellent performance!' : 
             grade === 'B' ? 'Good work!' : 
             grade === 'C' ? 'Satisfactory' : 'Needs improvement'
        ];
      });

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 135,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { 
          fillColor: [56, 189, 248], 
          textColor: 0,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        }
      });

      // Attendance section
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 135 + (tableRows.length * 15);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(15, finalY, 180, 30, 5, 5, 'F');
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Attendance Summary', 105, finalY + 18, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Present: ${attendanceData.present} days`, 25, finalY + 35);
      doc.text(`Absent: ${attendanceData.absent} days`, 100, finalY + 35);
      doc.text(`Attendance Rate: ${attendanceData.rate}%`, 155, finalY + 35);

      // Footer with date and signature
      doc.setFontSize(9);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 280, { align: 'center' });
      doc.text('Class Teacher: _________________________', 120, 290);
      doc.text('Head Teacher: _________________________', 120, 300);

      const filename = `${student.full_name.replace(/\s+/g, '_')}_${selectedTerm}_${selectedYear}_Report_Card`;
      doc.save(`${filename}.pdf`);
      showNotification('Report card downloaded successfully!');
    } catch {
      // Fallback to simple PDF
      const headers = ['Subject', 'Marks', 'Max Marks', 'Grade', 'Comment'];
      const rows = (marksData || []).map(m => {
        const grade = getOLevelGrade(m.marks, m.max_marks).grade;
        return [m.subjects?.name || 'Unknown', m.marks, m.max_marks, grade, m.comments || ''];
      });

      const filename = `${student.full_name.replace(/\s+/g, '_')}_${selectedTerm}_${selectedYear}_Report`;
      const headerText = `Report Card: ${student.full_name} | ${classInfo?.name} | ${selectedTerm} ${selectedYear} | ${schoolInfo?.name || 'School'}`;
      exportToPdf(headerText, headers, rows, filename);
      showNotification('Report downloaded successfully!');
    }
  };

  // Send report to parent
  const sendReportToParent = async (student) => {
    try {
      const schoolId = schoolInfo?.id;
      const { error } = await supabase
        .from('school_documents')
        .insert({
          school_id: schoolId,
          title: `Report Card: ${student.full_name}`,
          body: `${selectedTerm} ${selectedYear} report card for ${student.full_name} in ${classInfo?.name}`,
          doc_type: 'circular', // Use 'circular' so it appears in parents portal
          student_id: student.id,
          term: selectedTerm,
          year: parseInt(selectedYear),
          class_name: classInfo?.name
        });
      if (error) throw error;
      showNotification('Report sent to parent portal successfully!', 'success');
    } catch (error) {
      console.error('Error sending report:', error);
      // Try without the extra columns in case they don't exist yet
      try {
        const schoolId = schoolInfo?.id;
        const { error: fallbackError } = await supabase
          .from('school_documents')
          .insert({
            school_id: schoolId,
            title: `Report Card: ${student.full_name}`,
            body: `${selectedTerm} ${selectedYear} report card for ${student.full_name} in ${classInfo?.name}`,
            doc_type: 'circular'
          });
        if (fallbackError) throw fallbackError;
        showNotification('Report sent to parent portal successfully!', 'success');
      } catch (fallbackErr) {
        console.error('Error sending fallback report:', fallbackErr);
        showNotification('Failed to send report: ' + fallbackErr.message, 'error');
      }
    }
  };

  // Send all reports to parents
  const sendAllToParents = async () => {
    setSendingAll(true);
    try {
      const schoolId = schoolInfo?.id;
      const docs = students.map(student => ({
        school_id: schoolId,
        title: `Report Card: ${student.full_name}`,
        body: `${selectedTerm} ${selectedYear} report card for ${student.full_name} in ${classInfo?.name}`,
        doc_type: 'circular',
        student_id: student.id,
        term: selectedTerm,
        year: parseInt(selectedYear),
        class_name: classInfo?.name
      }));
      
      let insertError = null;
      try {
        const { error } = await supabase.from('school_documents').insert(docs);
        insertError = error;
      } catch (err) {
        insertError = err;
      }
      
      if (insertError) {
        // Fallback without extra columns
        const fallbackDocs = students.map(student => ({
          school_id: schoolId,
          title: `Report Card: ${student.full_name}`,
          body: `${selectedTerm} ${selectedYear} report card for ${student.full_name} in ${classInfo?.name}`,
          doc_type: 'circular'
        }));
        const { error: fallbackError } = await supabase.from('school_documents').insert(fallbackDocs);
        if (fallbackError) throw fallbackError;
      }
      
      showNotification(`${students.length} report cards sent to parents successfully!`, 'success');
    } catch (error) {
      console.error('Error sending all reports:', error);
      showNotification('Failed to send reports: ' + error.message, 'error');
    } finally {
      setSendingAll(false);
    }
  };

  // Navigate between students
  const nextStudent = () => {
    const currentIndex = students.findIndex(s => s.id === selectedStudent?.id);
    if (currentIndex < students.length - 1) {
      setSelectedStudent(students[currentIndex + 1]);
    }
  };

  const prevStudent = () => {
    const currentIndex = students.findIndex(s => s.id === selectedStudent?.id);
    if (currentIndex > 0) {
      setSelectedStudent(students[currentIndex - 1]);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-primary-400" size={48} />
        <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px] mt-4">Generating Report Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-right-6 duration-700 text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => navigate(`/classes/${classId}`)}
          className="flex items-center gap-2 text-primary-400 font-black text-[9px] lg:text-[10px] uppercase tracking-widest hover:gap-3 transition-all self-start"
        >
          <ChevronLeft size={14} /> Back to Class
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="w-10 h-10 lg:w-14 lg:h-14 bg-aurora-cyan/10 text-aurora-cyan rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-xl border border-aurora-cyan/20 shrink-0">
              <FileText size={20} lg:size={28} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl lg:text-3xl font-black text-white tracking-tight truncate leading-tight">{classInfo?.name} Report Cards</h2>
              <p className="text-slate-400 font-black text-[9px] lg:text-[10px] uppercase tracking-widest mt-1">{students.length} Students • {selectedTerm} {selectedYear}</p>
            </div>
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>

            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              {TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Student List (Horizontal Scroll) */}
      <div className="bg-slate-900 rounded-3xl lg:rounded-[2.5rem] p-3 lg:p-5 border border-slate-800 shadow-2xl">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Student</h3>
        <div className="flex gap-2 lg:gap-3 overflow-x-auto no-scrollbar pb-2">
          {students.map((student) => (
            <button
              key={student.id}
              onClick={() => setSelectedStudent(student)}
              className={`flex flex-col items-center justify-center gap-1.5 min-w-[75px] lg:min-w-[95px] max-w-[90px] lg:max-w-[110px] p-2.5 lg:p-3 rounded-2xl border-2 transition-all ${
                selectedStudent?.id === student.id
                  ? 'bg-primary-600/20 border-primary-500 text-white shadow-glow'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
              }`}
            >
              <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                selectedStudent?.id === student.id ? 'bg-primary-600' : 'bg-slate-800'
              }`}>
                {student.full_name.substring(0, 1).toUpperCase()}
              </div>
              <span className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest text-center leading-tight truncate w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {student.full_name}
              </span>
              {studentPositions[student.id] && (
                <span className="text-[7px] font-black text-aurora-amber uppercase tracking-widest">#{studentPositions[student.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Student Report Preview */}
      {selectedStudent && (
        <div className="bg-slate-900 rounded-3xl lg:rounded-[2.5rem] p-4 lg:p-8 border border-slate-800 shadow-2xl relative">
          {/* Report Header with Navigation */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <button onClick={prevStudent} disabled={students.indexOf(selectedStudent) === 0} className="p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
              <ArrowLeft size={18} />
            </button>
            <div className="text-center">
              <h3 className="font-black text-xl lg:text-2xl text-white tracking-tight">{selectedStudent.full_name}</h3>
              {studentPositions[selectedStudent.id] && (
                <p className="text-[9px] font-black text-aurora-amber uppercase tracking-widest mt-1">Position: #{studentPositions[selectedStudent.id]}</p>
              )}
            </div>
            <button onClick={nextStudent} disabled={students.indexOf(selectedStudent) === students.length - 1} className="p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30 transition-all">
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Report Content */}
          <div className="space-y-6">
            {/* School & Student Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <div className="space-y-2">
                {schoolInfo?.logo_url && (
                  <img src={schoolInfo.logo_url} alt="School Logo" className="w-14 h-14 lg:w-16 lg:h-16 object-contain rounded-lg" />
                )}
                <h4 className="text-base lg:text-lg font-black text-aurora-cyan tracking-tight">{schoolInfo?.name || 'School Name'}</h4>
                <p className="text-[10px] lg:text-xs font-bold text-slate-400">{schoolInfo?.address || 'School Address'}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Student</p>
                <p className="text-sm lg:text-base font-bold text-white">{selectedStudent.full_name}</p>
                <p className="text-[10px] lg:text-xs font-bold text-slate-400">{classInfo?.name}</p>
                <p className="text-[10px] lg:text-xs font-bold text-slate-400">{selectedTerm} {selectedYear}</p>
              </div>
            </div>

            {/* Marks Table */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-aurora-violet" />
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Academic Performance</h4>
              </div>
              <MarksTable studentId={selectedStudent.id} year={selectedYear} term={selectedTerm} />
            </div>

            {/* Attendance Summary */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-aurora-emerald" />
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attendance Summary</h4>
              </div>
              <AttendanceSummary studentId={selectedStudent.id} year={selectedYear} term={selectedTerm} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-8 pt-4 border-t border-slate-800">
            <button
              onClick={() => downloadReport(selectedStudent)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-aurora-cyan text-aurora-navy px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl font-black text-[9px] lg:text-[10px] uppercase tracking-[0.2em] shadow-glow hover:scale-[1.02] transition-all"
            >
              <Download size={14} lg:size={16} /> Download Report
            </button>
            <button
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-slate-300 px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl font-black text-[9px] lg:text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
            >
              <Share2 size={14} lg:size={16} /> Share Report
            </button>
            <button
              onClick={() => sendReportToParent(selectedStudent)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-aurora-emerald/10 border border-aurora-emerald/20 text-aurora-emerald px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl font-black text-[9px] lg:text-[10px] uppercase tracking-[0.2em] hover:bg-aurora-emerald/20 transition-all"
            >
              <Send size={14} lg:size={16} /> Send to Parent
            </button>
          </div>
        </div>
      )}

      {/* Class-Level Actions */}
      {students.length > 0 && (
        <div className="bg-slate-900/50 p-4 lg:p-6 rounded-3xl lg:rounded-[2.5rem] border border-slate-800 flex flex-wrap gap-3 items-center justify-between">
          <div className="space-y-1">
            <h4 className="font-black text-white text-[10px] lg:text-sm uppercase tracking-widest">Class Actions</h4>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{students.length} Report Cards Ready</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
              Download All (ZIP)
            </button>
            <button 
              onClick={sendAllToParents}
              disabled={sendingAll}
              className="px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl bg-aurora-amber/10 border border-aurora-amber/20 text-aurora-amber text-[9px] font-black uppercase tracking-widest hover:bg-aurora-amber/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingAll ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} lg:size={14} />
              )}
              {sendingAll ? 'Sending...' : 'Send All to Parents'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Child component to show marks
const MarksTable = ({ studentId, year, term }) => {
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarks = async () => {
      try {
        const { data, error } = await supabase
          .from('student_marks')
          .select(`*, subjects(name)`)
          .eq('student_id', studentId)
          .eq('year', parseInt(year))
          .eq('term', term);
        if (error) throw error;
        setMarks(data || []);
      } catch (error) {
        console.error('Error fetching marks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMarks();
  }, [studentId, year, term]);

  if (loading) return <div className="text-center py-6"><Loader2 size={18} className="animate-spin mx-auto text-slate-500" /></div>;

  if (marks.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl">
        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">No marks recorded for this term</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950">
            <th className="py-2.5 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Subject</th>
            <th className="py-2.5 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Marks</th>
            <th className="py-2.5 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Max</th>
            <th className="py-2.5 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Grade</th>
            <th className="py-2.5 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Comment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {marks.map((m) => {
            const { grade, description } = getOLevelGrade(m.marks, m.max_marks);
            const getGradeColor = () => {
              switch (grade) {
                case 'A': return 'text-aurora-emerald bg-aurora-emerald/10 border border-aurora-emerald/20';
                case 'B': return 'text-aurora-cyan bg-aurora-cyan/10 border border-aurora-cyan/20';
                case 'C': return 'text-aurora-amber bg-aurora-amber/10 border border-aurora-amber/20';
                default: return 'text-aurora-rose bg-aurora-rose/10 border border-aurora-rose/20';
              }
            };
            return (
              <tr key={m.id} className="hover:bg-white/5">
                <td className="py-3 px-3 font-bold text-slate-200 text-[13px]">{m.subjects?.name || 'Unknown'}</td>
                <td className="py-3 px-3 text-center font-black text-lg text-aurora-cyan">{m.marks}</td>
                <td className="py-3 px-3 text-center text-slate-500 font-bold">{m.max_marks}</td>
                <td className="py-3 px-3 text-center">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${getGradeColor()}`}>
                    {grade}
                  </span>
                </td>
                <td className="py-3 px-3 text-[10px] text-slate-400">{m.comments || description}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Child component to show attendance summary
const AttendanceSummary = ({ studentId, year, term }) => {
  const [data, setData] = useState({ present: 0, absent: 0, rate: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        const { data: attData, error } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', studentId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        if (error) throw error;
        const total = attData?.length || 0;
        const present = attData?.filter(a => a.status === 'present').length || 0;
        const absent = total - present;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        setData({ present, absent, rate, total });
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId, year, term]);

  if (loading) return <Loader2 size={18} className="animate-spin text-slate-500" />;

  return (
    <div className="grid grid-cols-3 gap-2 lg:gap-4">
      <div className="bg-aurora-emerald/10 border border-aurora-emerald/20 p-3 lg:p-4 rounded-2xl text-center">
        <p className="text-2xl lg:text-3xl font-black text-aurora-emerald">{data.present}</p>
        <p className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-widest">Present</p>
      </div>
      <div className="bg-aurora-rose/10 border border-aurora-rose/20 p-3 lg:p-4 rounded-2xl text-center">
        <p className="text-2xl lg:text-3xl font-black text-aurora-rose">{data.absent}</p>
        <p className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-widest">Absent</p>
      </div>
      <div className="bg-slate-950 border border-slate-800 p-3 lg:p-4 rounded-2xl text-center">
        <p className="text-2xl lg:text-3xl font-black text-slate-200">{data.rate}%</p>
        <p className="text-[8px] lg:text-[9px] font-black text-slate-500 uppercase tracking-widest">Attendance</p>
      </div>
    </div>
  );
};

export default ClassReportCards;
