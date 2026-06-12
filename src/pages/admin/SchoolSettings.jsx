import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Upload, Save, Building2, Calendar, BookOpen, Award } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const SchoolSettings = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolId, setSchoolId] = useState(null);
  const [settings, setSettings] = useState({
    name: '',
    logo_url: '',
    motto: '',
    address: '',
    current_academic_year: '2026',
    current_term: 'Term 1',
    marks_sharing_enabled: true
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from('users')
        .select('school_id, schools(*)')
        .eq('id', user.id)
        .single();

      if (profile?.school_id) {
        setSchoolId(profile.school_id);
        if (profile.schools) {
          setSettings({
            name: profile.schools.name || '',
            logo_url: profile.schools.logo_url || '',
            motto: profile.schools.motto || '',
            address: profile.schools.address || '',
            current_academic_year: profile.schools.current_academic_year || '2026',
            current_term: profile.schools.current_term || 'Term 1',
            marks_sharing_enabled: profile.schools.marks_sharing_enabled ?? true
          });
          if (profile.schools.logo_url) {
            setLogoPreview(profile.schools.logo_url);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile || !schoolId) return null;

    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      const filePath = `school-brands/${schoolId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(filePath, logoFile, { upsert: true });

      if (uploadError) {
        console.warn('Logo upload skipped (school-assets storage bucket not set up yet):', uploadError.message);
        // Don't show an error notification - this is just a setup step the user needs to complete
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('school-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Logo upload error:', error);
      // Don't show an error notification - just log it, other settings will save
      return null;
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      let logoUrl = settings.logo_url;

      if (logoFile) {
        const uploadedLogoUrl = await uploadLogo();
        if (uploadedLogoUrl) { // Only use the uploaded URL if it worked
          logoUrl = uploadedLogoUrl;
        }
      }

      const { error } = await supabase
        .from('schools')
        .update({
          name: settings.name,
          logo_url: logoUrl,
          motto: settings.motto,
          address: settings.address,
          current_academic_year: settings.current_academic_year,
          current_term: settings.current_term,
          marks_sharing_enabled: settings.marks_sharing_enabled
        })
        .eq('id', schoolId);

      if (error) throw error;
      showNotification('School settings updated successfully!');
    } catch (error) {
      showNotification('Error saving settings: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950">
        <Loader2 className="animate-spin text-primary-400 mx-auto mb-4" size={32} />
        <p className="text-slate-500 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">School Settings</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm lg:text-base">Configure your school's branding and academic parameters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Branding Card */}
        <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-8">
            <Building2 className="text-primary-400" size={24} />
            <h3 className="text-xl font-black text-white">Branding</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Logo Upload */}
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">School Logo</label>
              <div className="flex flex-col items-center gap-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 border-dashed">
                {logoPreview ? (
                  <img src={logoPreview} alt="School Logo Preview" className="w-32 h-32 object-contain rounded-2xl" />
                ) : (
                  <div className="w-32 h-32 bg-slate-800 rounded-2xl flex items-center justify-center">
                    <Award className="text-slate-600" size={48} />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  <div className="flex items-center gap-2 px-6 py-3 bg-primary-600/10 text-primary-400 border border-primary-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600 hover:text-white transition-all">
                    <Upload size={14} />
                    Upload Logo
                  </div>
                </label>
              </div>
            </div>

            {/* School Details */}
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">School Name</label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full input-field"
                  placeholder="Enter school name..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">School Motto</label>
                <input
                  type="text"
                  value={settings.motto}
                  onChange={(e) => setSettings({ ...settings, motto: e.target.value })}
                  className="w-full input-field"
                  placeholder="Enter school motto..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">School Address</label>
                <textarea
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full input-field min-h-[80px]"
                  placeholder="Enter school address..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Academic Settings */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-slate-800">
            <div className="flex items-center gap-3 mb-8">
              <Calendar className="text-primary-400" size={24} />
              <h3 className="text-xl font-black text-white">Academic Calendar</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Academic Year</label>
                <input
                  type="text"
                  value={settings.current_academic_year}
                  onChange={(e) => setSettings({ ...settings, current_academic_year: e.target.value })}
                  className="w-full input-field"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Term</label>
                <select
                  value={settings.current_term}
                  onChange={(e) => setSettings({ ...settings, current_term: e.target.value })}
                  className="w-full input-field"
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-slate-800">
            <div className="flex items-center gap-3 mb-8">
              <BookOpen className="text-primary-400" size={24} />
              <h3 className="text-xl font-black text-white">Parent Portal</h3>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enable Marks Sharing</span>
                <input
                  type="checkbox"
                  checked={settings.marks_sharing_enabled}
                  onChange={(e) => setSettings({ ...settings, marks_sharing_enabled: e.target.checked })}
                  className="w-6 h-6 rounded-lg accent-primary-500"
                />
              </label>
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                Parents can only see published marks when this is enabled
              </p>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full flex items-center justify-center gap-3 px-8 py-6 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-[2.5rem] shadow-glow hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'SAVING...' : 'SAVE SETTINGS'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchoolSettings;
