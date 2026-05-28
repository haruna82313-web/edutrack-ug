import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  FileText, Save, Loader2, ShieldCheck, 
  Info, AlertCircle, CheckCircle2, RefreshCw 
} from 'lucide-react';

import { useNotification } from '../../context/NotificationContext';

const PolicyEditor = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [policies, setPolicies] = useState({
    general_rules: '',
    privacy_policy: '',
    usage_terms: ''
  });
  const [activeTab, setActiveTab] = useState('general_rules');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPolicies();
  }, [user]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      
      if (profile?.school_id) {
        const { data, error } = await supabase
          .from('school_policies')
          .select('*')
          .eq('school_id', profile.school_id);

        if (error) throw error;
        
        const policyMap = { ...policies };
        data.forEach(p => {
          policyMap[p.policy_type] = p.content;
        });
        setPolicies(policyMap);
      }
    } catch (error) {
      console.error('Error fetching policies:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { data: profile } = await supabase.from('users').select('school_id').eq('id', user.id).single();
      
      if (!profile?.school_id) throw new Error('School identity not found');

      const { error } = await supabase
        .from('school_policies')
        .upsert({
          school_id: profile.school_id,
          policy_type: activeTab,
          content: policies[activeTab],
          updated_at: new Date().toISOString()
        }, { onConflict: 'school_id, policy_type' });

      if (error) throw error;
      
      showNotification('Policy successfully synchronized to the network.');
    } catch (error) {
      showNotification('Failed to synchronize: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general_rules', label: 'Institutional Rules', icon: <ShieldCheck size={16} /> },
    { id: 'privacy_policy', label: 'Data Privacy', icon: <FileText size={16} /> },
    { id: 'usage_terms', label: 'Usage Terms', icon: <Info size={16} /> }
  ];

  return (
    <div className="animate-in fade-in duration-700 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight uppercase">Policy Studio</h2>
          <p className="text-slate-500 mt-1 font-black text-[10px] sm:text-xs uppercase tracking-widest">
            Define and broadcast institutional guidelines to parents and staff.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-aurora-cyan text-aurora-navy px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-neon-cyan hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Synchronize Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Tabs */}
        <div className="lg:col-span-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                activeTab === tab.id 
                  ? 'bg-aurora-cyan/10 border-aurora-cyan text-aurora-cyan shadow-neon-cyan' 
                  : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          
          <div className="mt-8 p-6 bg-aurora-violet/5 rounded-3xl border border-aurora-violet/10 space-y-4">
            <div className="flex items-center gap-2 text-aurora-violet">
              <AlertCircle size={16} />
              <h4 className="text-[10px] font-black uppercase tracking-widest">Auto-Broadcast</h4>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
              Updating these policies will instantly notify all linked guardians via the Parent Portal.
            </p>
          </div>
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card p-2">
            {loading ? (
              <div className="h-[400px] flex flex-col items-center justify-center">
                <RefreshCw className="animate-spin text-aurora-cyan mb-4" size={32} />
                <p className="text-slate-500 font-black text-xs uppercase tracking-widest">Loading Institutional Node...</p>
              </div>
            ) : (
              <textarea
                value={policies[activeTab]}
                onChange={(e) => setPolicies({ ...policies, [activeTab]: e.target.value })}
                placeholder={`Type the ${tabs.find(t => t.id === activeTab).label} here... Use clear, professional language.`}
                className="w-full h-[500px] bg-transparent border-none focus:ring-0 text-slate-300 font-medium p-8 no-scrollbar resize-none leading-relaxed text-sm lg:text-base"
              />
            )}
          </div>


        </div>
      </div>
    </div>
  );
};

export default PolicyEditor;
