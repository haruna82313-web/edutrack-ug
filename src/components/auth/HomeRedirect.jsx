import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import AdminLayout from '../../layouts/AdminLayout';
import AdminDashboard from '../../pages/admin/AdminDashboard';
import TeacherDashboard from '../../pages/teacher/TeacherDashboard';
import { Loader2 } from 'lucide-react';

export const HomeRedirect = () => {
  const { user, loading } = useAuth();
  const [role, setRole] = useState(null);
  const [fetchingRole, setFetchingRole] = useState(true);

  useEffect(() => {
    async function getRole() {
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();
        setRole(data?.role);
      }
      setFetchingRole(false);
    }
    getRole();
  }, [user]);

  if (loading || fetchingRole) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  
  // Decides whether to wrap in AdminLayout or show the Teacher Mobile Portal
  return role === 'admin' ? (
    <AdminLayout>
      <AdminDashboard />
    </AdminLayout>
  ) : (
    <TeacherDashboard />
  );
};
