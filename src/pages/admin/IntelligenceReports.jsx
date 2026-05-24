import { useState } from 'react';
import { PieChart, Award, ChevronLeft } from 'lucide-react';
import AttendanceReports from './AttendanceReports';
import MarksReports from './MarksReports';

const IntelligenceReports = () => {
  const [activeTab, setActiveTab] = useState('attendance');

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Tab Switcher */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl lg:rounded-[2rem] shadow-xl border border-slate-800 max-w-md">
        <button 
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl lg:rounded-[1.5rem] font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all ${activeTab === 'attendance' ? 'bg-aurora-cyan text-aurora-navy shadow-neon-cyan' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <PieChart size={14} lg:size={16} /> Attendance
        </button>
        <button 
          onClick={() => setActiveTab('marks')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 lg:py-4 rounded-xl lg:rounded-[1.5rem] font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all ${activeTab === 'marks' ? 'bg-aurora-cyan text-aurora-navy shadow-neon-cyan' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Award size={14} lg:size={16} /> Academic Marks
        </button>
      </div>

      {/* Report Content */}
      <div className="animate-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'attendance' ? <AttendanceReports /> : <MarksReports />}
      </div>
    </div>
  );
};

export default IntelligenceReports;
