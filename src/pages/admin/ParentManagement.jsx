import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, UserCheck, UserX, Loader2, ShieldCheck, 
  Search, Phone, Mail, Check, X, Clock 
} from 'lucide-react';

const ParentManagement = () => {
  const { user } = useAuth();
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('pending'); // pending, approved, all
  const [schoolSettings, setSchoolSettings] = useState({ marks_sharing_enabled: true });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  useEffect(() => {
    fetchParents();
    fetchSchoolSettings();
  }, [user]);

  const fetchSchoolSettings = async () => {
    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      if (!profile?.school_id) return;

      const { data, error } = await supabase
        .from('schools')
        .select('marks_sharing_enabled')
        .eq('id', profile.school_id)
        .single();

      if (error) throw error;
      setSchoolSettings(data || { marks_sharing_enabled: true });
    } catch (error) {
      console.error('Error fetching school settings:', error.message);
    }
  };

  const toggleMarksSharing = async () => {
    setUpdatingSettings(true);
    try {
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      const newValue = !schoolSettings.marks_sharing_enabled;
      
      const { error } = await supabase
        .from('schools')
        .update({ marks_sharing_enabled: newValue })
        .eq('id', profile.school_id);

      if (error) throw error;
      setSchoolSettings({ ...schoolSettings, marks_sharing_enabled: newValue });
    } catch (error) {
      console.error('Error updating marks sharing:', error.message);
    } finally {
      setUpdatingSettings(false);
    }
  };

  const fetchParents = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      
      if (profile?.school_id) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('school_id', profile.school_id)
          .eq('role', 'parent')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setParents(data || []);
      }
    } catch (error) {
      console.error('Error fetching parents:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (parentId, newStatus) => {
    try {
      setProcessing(parentId);
      const { error } = await supabase
        .from('users')
        .update({ approval_status: newStatus })
        .eq('id', parentId);

      if (error) throw error;
      
      setParents(parents.map(p => 
        p.id === parentId ? { ...p, approval_status: newStatus } : p
      ));
    } catch (error) {
      alert('Failed to update status: ' + error.message);
    } finally {
      setProcessing(null);
    }
  };

  const filteredParents = parents.filter(p => {
    const matchesSearch = p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.phone_number?.includes(searchTerm);
    const matchesFilter = filter === 'all' ? true : p.approval_status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="animate-in fade-in duration-700 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight uppercase">Guardian Governance</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm lg:text-base">Manage parent access and portal visibility protocols.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="glass-card px-6 py-3 flex items-center gap-4 border-primary-500/20">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Marks Sharing</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${schoolSettings.marks_sharing_enabled ? 'text-emerald-400' : 'text-rose-500'}`}>
                {schoolSettings.marks_sharing_enabled ? 'Active' : 'Restricted'}
              </span>
            </div>
            <button 
              onClick={toggleMarksSharing}
              disabled={updatingSettings}
              className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${schoolSettings.marks_sharing_enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 transform ${schoolSettings.marks_sharing_enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>
          <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800">
            <button 
              onClick={() => setFilter('pending')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'pending' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Pending
            </button>
            <button 
              onClick={() => setFilter('approved')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'approved' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Approved
            </button>
            <button 
              onClick={() => setFilter('all')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'}`}
            >
              All Nodes
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-20 text-center">
            <Loader2 className="animate-spin text-aurora-violet mx-auto mb-4" size={40} />
            <p className="text-slate-500 font-black text-xs uppercase tracking-widest">Accessing Guardian Registry...</p>
          </div>
        ) : filteredParents.length === 0 ? (
          <div className="p-20 text-center border-2 border-dashed border-slate-800 rounded-[2.5rem] m-6">
            <ShieldCheck className="text-slate-800 mx-auto mb-4" size={48} />
            <p className="text-slate-600 font-black text-xs uppercase tracking-widest">
              {searchTerm ? 'No matching requests found' : `No ${filter} requests at this time`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Guardian Identity</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Contact</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredParents.map((parent) => (
                  <tr key={parent.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-aurora-violet/10 text-aurora-violet rounded-2xl flex items-center justify-center font-black text-lg border border-aurora-violet/20 group-hover:scale-110 transition-transform">
                          {parent.full_name?.substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-white tracking-tight">{parent.full_name}</p>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                            Registered {new Date(parent.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Phone size={12} className="text-aurora-violet" />
                          <span className="text-xs font-bold">{parent.phone_number || 'No Phone'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Mail size={12} />
                          <span className="text-[10px] font-medium">{parent.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        {parent.approval_status === 'pending' ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aurora-amber/10 text-aurora-amber text-[9px] font-black uppercase tracking-widest border border-aurora-amber/20">
                            <Clock size={10} /> Pending
                          </span>
                        ) : parent.approval_status === 'approved' ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aurora-emerald/10 text-aurora-emerald text-[9px] font-black uppercase tracking-widest border border-aurora-emerald/20">
                            <Check size={10} /> Authorized
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aurora-rose/10 text-aurora-rose text-[9px] font-black uppercase tracking-widest border border-aurora-rose/20">
                            <X size={10} /> Restricted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {processing === parent.id ? (
                        <Loader2 className="animate-spin text-aurora-violet ml-auto" size={20} />
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {parent.approval_status !== 'approved' && (
                            <button
                              onClick={() => handleStatusUpdate(parent.id, 'approved')}
                              className="p-2.5 bg-aurora-emerald/10 text-aurora-emerald rounded-xl hover:bg-aurora-emerald hover:text-white transition-all border border-aurora-emerald/20"
                              title="Approve Request"
                            >
                              <Check size={18} />
                            </button>
                          )}
                          {parent.approval_status !== 'rejected' && (
                            <button
                              onClick={() => handleStatusUpdate(parent.id, 'rejected')}
                              className="p-2.5 bg-aurora-rose/10 text-aurora-rose rounded-xl hover:bg-aurora-rose hover:text-white transition-all border border-aurora-rose/20"
                              title="Reject/Revoke Access"
                            >
                              <X size={18} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentManagement;
