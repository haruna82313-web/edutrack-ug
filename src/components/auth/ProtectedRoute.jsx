import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

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

  return children;
};
