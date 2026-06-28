import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, ArrowRight, Loader2, CheckCircle2, User, Users, Sparkles, Target } from 'lucide-react';

const Register = () => {
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('teacher'); // teacher or parent
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      let schoolId = null;
      let finalFullName = fullName;

      if (role === 'teacher') {
        // 1. Check if the email is invited
        const { data: invite, error: inviteErr } = await supabase
          .from('teacher_invites')
          .select('*')
          .eq('email', email.toLowerCase().trim())
          .single();

        if (inviteErr || !invite) {
          throw new Error("This email is not authorized as staff. Please contact your school administrator.");
        }
        schoolId = invite.school_id;
        finalFullName = invite.full_name;
      } else {
        // 1. Parent Registration Logic
        if (!phoneNumber) throw new Error("Phone number is required for parents.");
        
        // Use the Secure Handshake (RPC) to verify the phone number
        const { data: verifiedSid, error: verifyErr } = await supabase
          .rpc('verify_student_parent', { phone: phoneNumber.trim() });

        if (verifyErr || !verifiedSid || verifiedSid.length === 0) {
          throw new Error("This phone number is not recognized by our system. Please ensure the school has registered your number correctly.");
        }
        
        // The RPC returns a list, we take the first school_id found
        schoolId = verifiedSid[0].sid;
      }

      // 2. Sign up the user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authErr) throw authErr;

      if (authData.user) {
        // 3. Create the profile in 'users' table
        const { error: userErr } = await supabase.from('users').insert([{
          id: authData.user.id,
          school_id: schoolId,
          full_name: finalFullName,
          role: role,
          email: email.toLowerCase().trim(),
          phone_number: phoneNumber.trim(),
          approval_status: role === 'teacher' ? 'approved' : 'pending'
        }]);

        if (userErr) throw userErr;
        // Force the app to recognize the new profile immediately
        await refreshProfile();
      }

      setMessage(role === 'teacher' 
        ? "Verification email sent! Please check your inbox to activate your node."
        : "Registration submitted! Please check your email to verify. Your access will be active once the school administrator approves your request."
      );
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-dvh w-screen overflow-hidden bg-slate-950 font-sans relative flex flex-col md:flex-row">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-aurora-emerald/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-aurora-amber/20 rounded-full blur-[120px]"></div>
      </div>

      {/* Left Section: Glassmorphism Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative z-10 bg-slate-950 h-full overflow-hidden">
        <div className="w-full max-w-md space-y-4 sm:space-y-6 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-2xl p-6 sm:p-8 lg:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 animate-in fade-in slide-in-from-left-10 duration-1000">
          <div className="text-center md:text-left">
            <div className="mx-auto md:mx-0 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-aurora-emerald to-aurora-amber rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-glow transition-transform hover:scale-110 duration-500">
              {role === 'teacher' ? <GraduationCap className="text-white" size={32} /> : <Users className="text-white" size={32} />}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
              {role === 'teacher' ? 'Staff Onboarding' : 'Guardian Portal'}
            </h1>
            <p className="mt-1 sm:mt-2 text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-[0.25em]">
              {role === 'teacher' ? 'Institutional Initialization' : 'Community Connectivity'}
            </p>
          </div>
          
          {!message && (
            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/10">
              <button
                onClick={() => setRole('teacher')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  role === 'teacher' 
                    ? 'bg-gradient-to-r from-aurora-emerald to-aurora-amber text-white shadow-glow' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <User size={14} /> Staff
              </button>
              <button
                onClick={() => setRole('parent')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  role === 'parent' 
                    ? 'bg-gradient-to-r from-aurora-emerald to-aurora-amber text-white shadow-glow' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Users size={14} /> Parent
              </button>
            </div>
          )}

          {message ? (
            <div className="bg-emerald-500/10 text-emerald-400 p-8 rounded-3xl border border-emerald-500/20 text-center animate-in zoom-in duration-500">
              <div className="mx-auto w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={24} />
              </div>
              <h2 className="text-xl font-black mb-2 text-white">Registration Success</h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                {message}
              </p>
              <Link to="/login" className="w-full bg-gradient-to-r from-aurora-emerald to-aurora-amber py-4 sm:py-5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 flex items-center justify-center gap-3">
                Return to Login <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <div className="space-y-4 sm:space-y-5">
                {role === 'parent' && (
                  <>
                    <div className="group">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1 group-focus-within:text-aurora-emerald transition-colors">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter your full name"
                        className="w-full rounded-2xl border border-white/5 px-4 sm:px-6 py-3 sm:py-4 focus:ring-2 focus:ring-aurora-emerald/30 focus:border-aurora-emerald outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm sm:text-base"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="group">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1 group-focus-within:text-aurora-amber transition-colors">
                        Registered Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Phone linked to your child"
                        className="w-full rounded-2xl border border-white/5 px-4 sm:px-6 py-3 sm:py-4 focus:ring-2 focus:ring-aurora-amber/30 focus:border-aurora-amber outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm sm:text-base"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                  </>
                )}
                
                <div className="group">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1 group-focus-within:text-aurora-emerald transition-colors">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder={role === 'teacher' ? "Authorized staff email" : "Your personal email"}
                    className="w-full rounded-2xl border border-white/5 px-4 sm:px-6 py-3 sm:py-4 focus:ring-2 focus:ring-aurora-emerald/30 focus:border-aurora-emerald outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm sm:text-base"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <div className="relative group">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1 group-focus-within:text-aurora-amber transition-colors">
                    Access Key (Password)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-2xl border border-white/5 px-4 sm:px-6 py-3 sm:py-4 focus:ring-2 focus:ring-aurora-amber/30 focus:border-aurora-amber outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm sm:text-base"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-aurora-emerald to-aurora-amber py-4 sm:py-5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      {role === 'teacher' ? 'Initialize Node' : 'Request Access'} <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="pt-4 sm:pt-6 border-t border-white/5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Already have an account? <Link to="/login" className="text-aurora-emerald hover:text-white ml-1 transition-colors">Authorize Session</Link>
              </p>
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">v2.0.4-LTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section: Minimalist Branding */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden h-full border-l border-white/5">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="relative z-10 text-center space-y-8 lg:space-y-12 w-full px-8">
          <div className="space-y-4">
            <h2 className="text-5xl lg:text-7xl font-black text-white tracking-tighter animate-in fade-in slide-in-from-bottom-10 duration-1000">
              EDU<span className="text-transparent bg-clip-text bg-gradient-to-r from-aurora-emerald to-aurora-amber">TRACK</span> UG
            </h2>
            <div className="h-1 w-24 lg:w-32 bg-gradient-to-r from-aurora-emerald to-aurora-amber mx-auto rounded-full shadow-glow"></div>
          </div>
          
          <div className="space-y-6 text-center">
            <p className="text-2xl lg:text-3xl font-black uppercase tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-aurora-emerald via-white to-aurora-amber">
              REGISTER TODAY
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 lg:gap-12 pt-8 lg:pt-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-aurora-emerald shadow-glow transition-transform hover:scale-110 duration-500">
                <Sparkles size={24} />
              </div>
              <span className="text-[8px] lg:text-[9px] font-black text-slate-600 uppercase tracking-widest">Intelligent</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-aurora-amber shadow-glow transition-transform hover:scale-110 duration-500">
                <Target size={24} />
              </div>
              <span className="text-[8px] lg:text-[9px] font-black text-slate-600 uppercase tracking-widest">Precise</span>
            </div>
          </div>
        </div>

        {/* Floating subtle ambient glows */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-aurora-emerald/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-aurora-amber/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>
      </div>
    </div>
  );
};

export default Register;
