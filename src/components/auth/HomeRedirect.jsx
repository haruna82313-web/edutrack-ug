import { useAuth } from '../../context/AuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import AdminDashboard from '../../pages/admin/AdminDashboard';
import TeacherDashboard from '../../pages/teacher/TeacherDashboard';
import ParentDashboard from '../../pages/parent/ParentDashboard';
import { Loader2 } from 'lucide-react';

export const HomeRedirect = () => {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
        <p className="mt-4 text-slate-500 font-black text-[10px] uppercase tracking-widest animate-pulse">
          Authenticating Node...
        </p>
      </div>
    );
  }
  
  // Decides whether to wrap in AdminLayout or show the specific Dashboard
  if (profile.role === 'admin') {
    return (
      <AdminLayout>
        <AdminDashboard />
      </AdminLayout>
    );
  } else if (profile.role === 'teacher') {
    return <TeacherDashboard />;
  } else if (profile.role === 'parent') {
    return <ParentDashboard />;
  }

  return null;
};
