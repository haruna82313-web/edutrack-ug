import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Upload, Save, Building2, Calendar, BookOpen, Award, Plus, Trash2 } from 'lucide-react';
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
    type: 'secondary',
    current_academic_year: '2026',
    current_term: 'Term 1',
    marks_sharing_enabled: true
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [gradingConfigs, setGradingConfigs] = useState([]);
  const [savingGrading, setSavingGrading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (schoolId) {
      fetchGradingConfigs();
    }
  }, [schoolId, settings.type]);

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
            type: profile.schools.type || 'secondary',
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
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('school-assets')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Logo upload error:', error);
      return null;
    }
  };

  const fetchGradingConfigs = async () => {
    if (!schoolId || settings.type !== 'primary') return;
    try {
      const { data } = await supabase
        .from('grading_configs')
        .select('*')
        .eq('school_id', schoolId)
        .order('min_score', { ascending: false });
      setGradingConfigs(data || []);
    } catch (error) {
      console.error('Error fetching grading configs:', error);
    }
  };

  const addGradingRule = () => {
    setGradingConfigs([
      ...gradingConfigs,
      { id: null, grade_name: '', description: '', min_score: 0, max_score: 100 }
    ]);
  };

  const deleteGradingRule = (index) => {
    const newConfigs = [...gradingConfigs];
    newConfigs.splice(index, 1);
    setGradingConfigs(newConfigs);
  };

  const updateGradingRule = (index, field, value) => {
    const newConfigs = [...gradingConfigs];
    newConfigs[index][field] = value;
    setGradingConfigs(newConfigs);
  };

  const saveGradingConfigs = async () => {
    if (!schoolId) return;
    try {
      setSavingGrading(true);
      // Delete existing configs
      await supabase
        .from('grading_configs')
        .delete()
        .eq('school_id', schoolId);
      // Insert new ones
      const configsToInsert = gradingConfigs.map(c => ({
        school_id: schoolId,
        grade_name: c.grade_name,
        description: c.description,
        min_score: Number(c.min_score),
        max_score: Number(c.max_score)
      }));
      await supabase
        .from('grading_configs')
        .insert(configsToInsert);
      showNotification('Grading config saved!');
    } catch (error) {
      showNotification('Error saving grading: ' + error.message, 'error');
    } finally {
      setSavingGrading(false);
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
          type: settings.type,
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

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">School Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${
                      settings.type === 'primary'
                        ? 'border-aurora-cyan bg-aurora-cyan/10 text-aurora-cyan'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="schoolType"
                      value="primary"
                      checked={settings.type === 'primary'}
                      onChange={(e) => setSettings({ ...settings, type: e.target.value })}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="font-black text-sm mb-1">Primary School</div>
                      <div className="text-[8px] uppercase tracking-widest">P1 - P7</div>
                    </div>
                  </label>

                  <label
                    className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${
                      settings.type === 'secondary'
                        ? 'border-aurora-cyan bg-aurora-cyan/10 text-aurora-cyan'
                        : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="schoolType"
                      value="secondary"
                      checked={settings.type === 'secondary'}
                      onChange={(e) => setSettings({ ...settings, type: e.target.value })}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="font-black text-sm mb-1">Secondary School</div>
                      <div className="text-[8px] uppercase tracking-widest">S1 - S6</div>
                    </div>
                  </label>
                </div>
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

          {/* Grading Config (Primary Only) */}
          {settings.type === 'primary' && (
            <div className="bg-slate-900 p-6 lg:p-8 rounded-[2.5rem] shadow-2xl border border-slate-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                  <Award className="text-emerald-400" size={24} />
                  <div>
                    <h3 className="text-xl font-black text-white">Grading Configuration</h3>
                    <p className="text-slate-500 text-xs mt-1">Customize how marks are graded for your primary school</p>
                  </div>
                </div>
                <button
                  onClick={addGradingRule}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all"
                >
                  <Plus size={16} /> Add Grade Rule
                </button>
              </div>

              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                {gradingConfigs.map((config, index) => (
                  <div
                    key={index}
                    className="p-5 lg:p-6 bg-slate-950 rounded-3xl border border-slate-800 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Rule #{index + 1}</span>
                      </div>
                      <button
                        onClick={() => deleteGradingRule(index)}
                        className="p-2 text-red-400 hover:text-white hover:bg-red-600/20 rounded-xl transition-all"
                        title="Delete Rule"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="space-y-5">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Grade Symbol</label>
                          <input
                            type="text"
                            value={config.grade_name}
                            onChange={(e) => updateGradingRule(index, 'grade_name', e.target.value)}
                            className="w-full input-field text-base"
                            placeholder="e.g., A, B+, C"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                          <input
                            type="text"
                            value={config.description}
                            onChange={(e) => updateGradingRule(index, 'description', e.target.value)}
                            className="w-full input-field text-base"
                            placeholder="e.g., Excellent, Very Good"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Score Range</label>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Minimum</label>
                            <input
                              type="number"
                              value={config.min_score}
                              onChange={(e) => updateGradingRule(index, 'min_score', e.target.value)}
                              className="w-full input-field text-base"
                              min="0"
                              max="100"
                              placeholder="0"
                            />
                          </div>
                          <div className="text-slate-600 font-bold text-lg">—</div>
                          <div className="flex-1">
                            <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Maximum</label>
                            <input
                              type="number"
                              value={config.max_score}
                              onChange={(e) => updateGradingRule(index, 'max_score', e.target.value)}
                              className="w-full input-field text-base"
                              min="0"
                              max="100"
                              placeholder="100"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {gradingConfigs.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl">
                  <Award className="text-slate-700 mx-auto mb-4" size={32} />
                  <p className="text-slate-500 font-bold text-sm mb-2">No grading rules yet</p>
                  <p className="text-slate-600 text-xs">Click "Add Grade Rule" to get started</p>
                </div>
              )}

              {gradingConfigs.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-800">
                  <button
                    onClick={saveGradingConfigs}
                    disabled={savingGrading}
                    className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-lg hover:shadow-emerald-500/20 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {savingGrading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {savingGrading ? 'SAVING GRADING CONFIGURATION...' : 'SAVE GRADING CONFIGURATION'}
                  </button>
                </div>
              )}
            </div>
          )}

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
