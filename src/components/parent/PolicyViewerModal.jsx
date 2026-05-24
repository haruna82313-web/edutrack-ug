import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  X, ShieldCheck, FileText, Info, 
  Loader2, CheckCircle2, ChevronRight 
} from 'lucide-react';

const PolicyViewerModal = ({ isOpen, onClose, schoolId }) => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general_rules');

  useEffect(() => {
    if (isOpen && schoolId) {
      fetchPolicies();
    }
  }, [isOpen, schoolId]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('school_policies')
        .select('*')
        .eq('school_id', schoolId);

      if (error) throw error;
      
      // Define system defaults as requested by the user
      const systemDefaults = [
        {
          policy_type: 'privacy_policy',
          content: `EduTrack Guardian is committed to protecting the privacy and security of your family's educational data. We understand that student records, academic performance, and attendance logs are highly sensitive pieces of information. This Privacy Policy outlines how we handle data within the Guardian Node to ensure complete confidentiality and security.

1. Data Collection: We only process information that is essential for the educational tracking of your children. This includes student names, enrollment details, academic marks submitted by verified teachers, and attendance logs. We also store your phone number and notification preferences to facilitate real-time communication.

2. Data Usage: Your data is used exclusively to provide you with insights into your child's progress. We do not sell, trade, or share your family's information with third-party advertisers or external organizations. All processing is strictly limited to the purposes of the EduTrack UG ecosystem.

3. Security Measures: All communications between your device and our servers are encrypted using industry-standard SSL/TLS protocols. Your data is stored in secure, restricted-access databases managed by Supabase.

4. Authorization: Access to student data is strictly controlled through phone-number-based linking. Only verified parents can access the records of their specific children.

5. Your Rights: You have the right to review the information stored about your child and request corrections through the school administration. We retain data only as long as necessary for the educational cycle or as required by institutional guidelines.

By using EduTrack Guardian, you trust us with your family's data, and we take that responsibility seriously. Our core mission is to empower parents through information while maintaining the highest standards of data integrity and privacy.`
        },
        {
          policy_type: 'usage_terms',
          content: `Welcome to the EduTrack Guardian Portal. By accessing this platform, you agree to comply with the following terms of use designed to ensure a secure and productive educational environment for all stakeholders.

1. Authorized Access: You agree to access only the records of children for whom you are the legally recognized guardian. Any attempt to access unauthorized data or bypass security protocols is strictly prohibited.

2. Information Accuracy: While EduTrack UG strives for real-time accuracy, marks and attendance are submitted by institutional staff. Any discrepancies should be addressed directly with the school administration.

3. Portal Usage: This portal is intended for informational purposes. You agree not to use the system for any unlawful activity or to harass institutional staff.

4. Notification Responsibility: By enabling "The Pulse," you agree to receive automated notifications. It is your responsibility to ensure your device settings allow for these critical alerts.

5. Institutional Governance: Use of this portal is subject to the overarching rules and regulations of your child's school. The administration reserves the right to suspend portal access in cases of misuse or violation of school charter policies.

These terms are governed by the laws of Uganda and the specific bylaws of your educational institution.`
        }
      ];

      // Merge fetched policies with defaults (admin-uploaded policies override defaults)
      const mergedPolicies = [...systemDefaults];
      if (data) {
        data.forEach(p => {
          const index = mergedPolicies.findIndex(dp => dp.policy_type === p.policy_type);
          if (index !== -1) {
            mergedPolicies[index] = p;
          } else {
            mergedPolicies.push(p);
          }
        });
      }

      setPolicies(mergedPolicies);
      
      // Default to the first available policy if general_rules is empty
      if (mergedPolicies.length > 0 && !mergedPolicies.find(p => p.policy_type === 'general_rules')) {
        setActiveTab(mergedPolicies[0].policy_type);
      }
    } catch (error) {
      console.error('Error fetching policies:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentPolicy = policies.find(p => p.policy_type === activeTab);

  const tabs = [
    { id: 'general_rules', label: 'Guidelines', icon: <ShieldCheck size={14} /> },
    { id: 'privacy_policy', label: 'Privacy', icon: <FileText size={14} /> },
    { id: 'usage_terms', label: 'Terms', icon: <Info size={14} /> }
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-aurora-violet/10 rounded-xl flex items-center justify-center text-aurora-violet border border-aurora-violet/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Institutional Charter</h2>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Rules & Regulatory Principles</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950/50 p-2 gap-1 border-b border-white/5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'bg-white/5 text-white border border-white/10 shadow-glow' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-aurora-violet mb-4" size={32} />
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest">Accessing Charter Node...</p>
            </div>
          ) : !currentPolicy || !currentPolicy.content ? (
            <div className="h-64 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-700">
                <FileText size={32} />
              </div>
              <div>
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">No Content Defined</p>
                <p className="text-slate-600 font-bold text-[8px] uppercase tracking-widest mt-1">The administration has not yet published this section.</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-slate-300 font-medium leading-relaxed text-sm sm:text-base">
                {currentPolicy.content}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Verified Institutional Document</span>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolicyViewerModal;
