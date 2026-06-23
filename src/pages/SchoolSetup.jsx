import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, ArrowRight, Loader2, School, Eye, EyeOff } from 'lucide-react';

const SchoolSetup = () => {
  const [formData, setFormData] = useState({ schoolName: '', adminName: '', email: '', password: '', schoolType: 'secondary' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSetup = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create the School
      const { data: school, error: schoolErr } = await supabase
        .from('schools')
        .insert([{ name: formData.schoolName, type: formData.schoolType }])
        .select()
        .single();

      if (schoolErr) throw schoolErr;

      // 2. Sign up the Admin User
      const { data: auth, error: authErr } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authErr) throw authErr;

      // 3. Create the Admin Profile in our 'users' table
      const { error: userErr } = await supabase.from('users').insert([{
        id: auth.user.id,
        school_id: school.id,
        full_name: formData.adminName,
        role: 'admin',
        email: formData.email
      }]);

      if (userErr) throw userErr;

      navigate('/login');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-dvh w-screen overflow-hidden bg-slate-950 px-4 font-sans relative flex items-center justify-center">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-700 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-xl bg-slate-900/50 backdrop-blur-xl p-6 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative z-10 border border-white/10 animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-6 sm:mb-8">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mb-4 shadow-glow border border-white/10 transition-transform hover:scale-110 duration-500">
            <School className="text-white" size={28} sm:size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tighter">Register School</h2>
          <p className="text-slate-500 mt-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">Institutional Initialization</p>
        </div>
        
        <form onSubmit={handleSetup} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">Institution Name</label>
            <input 
              type="text" 
              placeholder="e.g. Kampala International School" 
              className="w-full rounded-2xl border border-white/5 px-4 py-3 sm:py-3.5 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm" 
              onChange={(e) => setFormData({...formData, schoolName: e.target.value})} 
              required 
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">School Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                  formData.schoolType === 'primary'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/5 bg-white/[0.02] text-slate-500 hover:border-white/10'
                }`}
              >
                <input
                  type="radio"
                  name="schoolType"
                  value="primary"
                  checked={formData.schoolType === 'primary'}
                  onChange={(e) => setFormData({ ...formData, schoolType: e.target.value })}
                  className="hidden"
                />
                <div className="text-center">
                  <div className="text-sm sm:text-base font-black mb-1">Primary School</div>
                  <div className="text-[7px] sm:text-[8px] uppercase tracking-widest">P1 - P7</div>
                </div>
              </label>

              <label
                className={`cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                  formData.schoolType === 'secondary'
                    ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                    : 'border-white/5 bg-white/[0.02] text-slate-500 hover:border-white/10'
                }`}
              >
                <input
                  type="radio"
                  name="schoolType"
                  value="secondary"
                  checked={formData.schoolType === 'secondary'}
                  onChange={(e) => setFormData({ ...formData, schoolType: e.target.value })}
                  className="hidden"
                />
                <div className="text-center">
                  <div className="text-sm sm:text-base font-black mb-1">Secondary School</div>
                  <div className="text-[7px] sm:text-[8px] uppercase tracking-widest">S1 - S6 (UNEB)</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">Admin Name</label>
            <input 
              type="text" 
              placeholder="Full Name" 
              className="w-full rounded-2xl border border-white/5 px-4 py-3 sm:py-3.5 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm" 
              onChange={(e) => setFormData({...formData, adminName: e.target.value})} 
              required 
            />
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">Admin Email</label>
            <input 
              type="email" 
              placeholder="admin@school.edu" 
              className="w-full rounded-2xl border border-white/5 px-4 py-3 sm:py-3.5 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm" 
              onChange={(e) => setFormData({...formData, email: e.target.value})} 
              required 
            />
          </div>

          <div className="sm:col-span-2 relative">
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">Security Key (Password)</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Minimum 8 characters" 
                className="w-full rounded-2xl border border-white/5 px-4 py-3 sm:py-3.5 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm" 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                required 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <div className="sm:col-span-2 pt-2 sm:pt-4">
            <button 
              disabled={loading} 
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 flex items-center justify-center gap-3"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Initialize Institution <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 sm:mt-8 text-center border-t border-white/5 pt-4 sm:pt-6">
          <Link to="/login" className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-primary-400 transition-colors">
            Already have a node? <span className="text-primary-400">Authorize Session</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SchoolSetup;
