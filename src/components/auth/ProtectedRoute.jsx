import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Clock } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, profile, loading } = useAuth();

  // Loading State UI
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
      <div className="mt-4 text-slate-500 font-medium animate-pulse text-sm tracking-wide">
        EduTrack Security Check...
      </div>
    </div>
  );

  // Auth Guard
  if (!user) return <Navigate to="/login" />;
  
  // Role Guard
  if (allowedRole && profile?.role !== allowedRole) {
    return <Navigate to="/" />;
  }

  // Approval Guard for Parents
  if (profile?.role === 'parent' && profile?.approval_status !== 'approved') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <div className="w-20 h-20 bg-aurora-amber/10 rounded-3xl flex items-center justify-center mb-8 border border-aurora-amber/20 shadow-neon-amber animate-pulse">
          <Clock className="text-aurora-amber" size={40} />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Access Pending Authorization</h2>
        <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] max-w-sm leading-relaxed mb-8">
          Your guardian node has been initialized, but it requires verification from the school administrator before data synchronization can begin.
        </p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-sm font-black text-aurora-amber uppercase tracking-widest">Verification in Progress</p>
          </div>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            Switch Account
          </button>
        </div>
      </div>
    );
  }

  return children;
};
