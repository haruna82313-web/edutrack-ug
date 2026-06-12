import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Users, ChevronLeft, Phone, UserPlus, Trash2, 
  Loader2, GraduationCap, Calendar, BookOpen, ArrowRight, Star, ShieldCheck, Target, TrendingUp, FileSpreadsheet, FileText
} from 'lucide-react';
import StudentDetailsModal from '../../components/admin/StudentDetailsModal';

const LEADERSHIP_ROLES = [
  { value: 'class_rep', label: 'Class Representative' },
  { value: 'prefect', label: 'Prefect' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'class_leader', label: 'Class Leader' },
  { value: 'religious_leader', label: 'Religious Leader' },
];

const ClassDetails = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [stats, setStats] = useState({
    attendanceRate: 0,
    performance: 0,
    syllabusProgress: 0
  });

  useEffect(() => {
    fetchClassData(filterDate);
  }, [classId, filterDate]);

  const fetchClassData = async (date = filterDate) => {
    try {
      setLoading(true);
      
      // 1. Fetch Class Info
      const { data: cls, error: clsErr } = await supabase
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (clsErr) throw clsErr;
      setClassInfo(cls);

      // 2. Fetch Students for this class
      const { data: stds, error: stdsErr } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('full_name');

      if (stdsErr) throw stdsErr;
      setStudents(stds || []);

      // 3. Calculate Stats
      if (stds?.length > 0) {
        const studentIds = stds.map(s => s.id);
        
        // Fetch Attendance
        let attQuery = supabase
          .from('attendance')
          .select('status')
          .in('student_id', studentIds);
        
        if (date) {
          attQuery = attQuery.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
        }
        
        const { data: attData } = await attQuery;
        
        const attendanceRate = attData?.length > 0
          ? (attData.filter(a => a.status === 'present').length / attData.length) * 100
          : 0;

        // Fetch Performance
        let marksQuery = supabase
          .from('student_marks')
          .select('marks, max_marks')
          .in('student_id', studentIds);
        
        if (date) {
          marksQuery = marksQuery.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
        }

        const { data: marksData } = await marksQuery;
        
        const performance = marksData?.length > 0
          ? (marksData.reduce((acc, m) => acc + (m.marks / m.max_marks), 0) / marksData.length) * 100
          : 0;

        // Fetch Syllabus Progress
        const { data: topics } = await supabase
          .from('syllabus_topics')
          .select('status')
          .eq('class_id', classId);
        
        const syllabusProgress = topics?.length > 0
          ? (topics.filter(t => t.status === 'completed').length / topics.length) * 100
          : 0;

        setStats({
          attendanceRate: Math.round(attendanceRate),
          performance: Math.round(performance) || 0,
          syllabusProgress: Math.round(syllabusProgress)
        });
      }

    } catch (error) {
      console.error('Error fetching class details:', error.message);
      // If student_marks doesn't exist yet, we still want to show other data
      if (error.message.includes('student_marks')) {
        // Just ignore marks for now if table doesn't exist
      } else {
        // navigate('/classes');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => filterGender === 'all' || s.gender === filterGender);

  const maleCount = filteredStudents.filter(s => s.gender === 'Male').length;
  const femaleCount = filteredStudents.filter(s => s.gender === 'Female').length;

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-primary-400 mb-4" size={40} />
        <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">Accessing Class Registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-10 animate-in fade-in slide-in-from-right-6 duration-700 text-slate-100">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-5">
        <button 
          onClick={() => navigate('/classes')}
          className="flex items-center gap-2 text-primary-400 font-black text-[9px] lg:text-[10px] uppercase tracking-widest hover:gap-3 transition-all self-start"
        >
          <ChevronLeft size={14} /> Back to Registry
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 lg:gap-5">
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-slate-900 text-primary-400 rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-2xl border border-slate-800 shrink-0">
              <GraduationCap size={24} lg:size={32} />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl lg:text-4xl font-black text-white tracking-tight truncate leading-tight">{classInfo?.name}</h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
                <span className="text-slate-400 font-black text-[10px] lg:text-sm flex items-center gap-1.5 uppercase tracking-wide">
                  <Users size={14} lg:size={16} className="text-primary-500 shrink-0" /> {filteredStudents.length} Enrolled
                </span>
                <span className="hidden sm:block w-1 h-1 bg-slate-800 rounded-full"></span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] lg:text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> M: {maleCount}
                  </span>
                  <span className="text-[10px] lg:text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div> F: {femaleCount}
                  </span>
                </div>
                <span className="hidden sm:block w-1 h-1 bg-slate-800 rounded-full"></span>
                <span className="text-slate-400 font-black text-[10px] lg:text-sm flex items-center gap-1.5 uppercase tracking-wide">
                  <Calendar size={14} lg:size={16} className="text-primary-500 shrink-0" /> Active Cycle 2026
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex items-center bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800">
              <Users className="text-slate-500 mr-2" size={16} />
              <select
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-300 focus:ring-0 cursor-pointer outline-none"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <option value="all" className="bg-slate-900 text-white">All Genders</option>
                <option value="Male" className="bg-slate-900 text-white">Male</option>
                <option value="Female" className="bg-slate-900 text-white">Female</option>
              </select>
            </div>
            <div className="relative flex items-center bg-slate-900 px-4 py-2 rounded-2xl shadow-xl border border-slate-800">
              <input
                type="date"
                className="bg-transparent border-none text-xs font-bold text-slate-300 focus:ring-0 cursor-pointer"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              {filterDate && (
                <button 
                  onClick={() => setFilterDate('')}
                  className="ml-2 text-slate-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Link 
              to={`/classes/${classId}/reports`} 
              className="btn-primary py-3 lg:py-4 px-6 lg:px-8 shadow-glow self-start md:self-auto text-[10px] lg:text-xs font-black uppercase tracking-widest"
            >
              <FileText size={16} lg:size={18} /> Report Cards
            </Link>
            <Link 
              to="/students" 
              className="py-3 lg:py-4 px-6 lg:px-8 bg-white/5 border border-white/10 rounded-2xl text-slate-300 text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all self-start md:self-auto"
            >
              <UserPlus size={16} lg:size={18} /> Enroll Student
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-slate-900 p-5 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-3xl transition-all group-hover:w-20 group-hover:h-20"></div>
          <div className="flex items-center gap-3 mb-2">
            <Target size={14} className="text-emerald-500" />
            <p className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest">Performance</p>
          </div>
          <p className="text-xl lg:text-2xl font-black text-white tracking-tight">
            {stats.performance}% 
            <span className={`text-[10px] font-black ml-1 uppercase ${stats.performance > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {stats.performance > 70 ? 'High' : 'Improving'}
            </span>
          </p>
        </div>
        <div className="bg-slate-900 p-5 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-aurora-cyan/5 rounded-bl-3xl transition-all group-hover:w-20 group-hover:h-20"></div>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={14} className="text-aurora-cyan" />
            <p className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest">Attendance</p>
          </div>
          <p className="text-xl lg:text-2xl font-black text-white tracking-tight">
            {stats.attendanceRate}% 
            <span className="text-slate-400 text-[10px] font-black ml-1 uppercase">
              {stats.attendanceRate > 90 ? 'Excellent' : 'Stable'}
            </span>
          </p>
        </div>
        <div className="bg-slate-900 p-5 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-800 shadow-xl sm:col-span-2 lg:col-span-1 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-aurora-violet/5 rounded-bl-3xl transition-all group-hover:w-20 group-hover:h-20"></div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen size={14} className="text-aurora-violet" />
            <p className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest">Syllabus</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div className="h-full bg-aurora-violet rounded-full shadow-glow" style={{ width: `${stats.syllabusProgress}%` }}></div>
            </div>
            <span className="text-xs font-black text-white">{stats.syllabusProgress}%</span>
          </div>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <h3 className="font-black text-white tracking-tight uppercase text-xs tracking-[0.1em]">Enrolled Students</h3>
          <span className="text-[10px] font-black bg-slate-950 border border-slate-800 text-slate-400 px-3 py-1 rounded-full uppercase tracking-widest">Node ID: {classId.substring(0, 4)}</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Name</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Guardian Contact</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 lg:px-8 py-20 text-center">
                    <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">No students matching the criteria found.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => { setSelectedStudent(student); setShowDetails(true); }}>
                    <td className="px-6 lg:px-8 py-4 lg:py-5">
                      <div className="flex items-center gap-3 lg:gap-4">
                        <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center font-black text-[10px] lg:text-xs shrink-0 border transition-all ${
                          student.leadership_role 
                            ? 'bg-aurora-amber/20 text-aurora-amber border-aurora-amber/20 shadow-neon-amber' 
                            : 'bg-primary-600/10 text-primary-400 border-primary-500/10 shadow-glow'
                        }`}>
                          {student.leadership_role ? <Star size={14} lg:size={16} /> : student.full_name.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-black text-slate-100 tracking-tight truncate text-sm lg:text-base group-hover:text-primary-400 transition-colors">
                            {student.full_name}
                          </span>
                          {student.leadership_role && (
                            <span className="text-[8px] lg:text-[9px] font-black text-aurora-amber uppercase tracking-widest flex items-center gap-1">
                              <ShieldCheck size={10} /> {LEADERSHIP_ROLES.find(r => r.value === student.leadership_role)?.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 lg:px-8 py-4 lg:py-5 hidden sm:table-cell">
                      <a 
                        href={`tel:${student.parent_phone}`}
                        className="flex items-center gap-2 text-slate-400 font-black text-sm uppercase hover:text-primary-400 transition-colors"
                      >
                        <Phone size={14} className="text-primary-500" /> {student.parent_phone}
                      </a>
                    </td>
                    <td className="px-6 lg:px-8 py-4 lg:py-5 text-right">
                      <div className="flex items-center justify-end gap-1 lg:gap-2">
                        <Link 
                          to={`/export?format=pdf&studentId=${student.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-slate-500 hover:text-aurora-cyan transition-colors"
                          title="Generate Report Card"
                        >
                          <FileSpreadsheet size={16} lg:size={18} />
                        </Link>
                        <button className="p-2 text-slate-500 hover:text-primary-400 transition-colors">
                          <ArrowRight size={16} lg:size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StudentDetailsModal 
        student={selectedStudent} 
        open={showDetails} 
        onClose={() => setShowDetails(false)} 
      />
    </div>
  );
};

export default ClassDetails;
