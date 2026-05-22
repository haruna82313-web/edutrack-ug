import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // 1. Check if the email is invited
      const { data: invite, error: inviteErr } = await supabase
        .from('teacher_invites')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (inviteErr || !invite) {
        throw new Error("This email is not authorized. Please contact your school administrator to grant you access.");
      }

      // 2. Sign up the user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authErr) throw authErr;

      if (authData.user) {
        // 3. Create the teacher profile in 'users' table
        const { error: userErr } = await supabase.from('users').insert([{
          id: authData.user.id,
          school_id: invite.school_id,
          full_name: invite.full_name,
          role: 'teacher',
          email: email.toLowerCase().trim()
        }]);

        if (userErr) throw userErr;
      }

      setMessage("Verification email sent! Please check your inbox to activate your node.");
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 font-sans relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-700 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md space-y-10 rounded-[2.5rem] bg-slate-900 p-10 shadow-2xl shadow-black/50 border border-slate-800 relative z-10">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mb-6 shadow-glow">
            <GraduationCap className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Staff Onboarding</h1>
          <p className="mt-3 text-sm text-slate-500 font-medium tracking-tight">
            Initialize your node in the network
          </p>
        </div>

        {message ? (
          <div className="bg-emerald-500/10 text-emerald-400 p-8 rounded-3xl border border-emerald-500/20 text-center animate-in zoom-in duration-500 shadow-emerald-glow">
            <div className="mx-auto w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="text-xl font-black mb-2">Check Your Email</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              We've sent a verification link to <span className="text-emerald-400 font-bold">{email}</span>. 
              New teachers must click this link to verify their identity before they can log in.
            </p>
            <div className="space-y-3">
              <Link to="/login" className="btn-primary w-full py-3">
                Return to Login
              </Link>
              <button 
                onClick={() => setMessage(null)} 
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
              >
                Entered wrong email? Start over
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="Authorized staff email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                  Define Access Key
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Minimum 8 characters"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[38px] text-slate-600 hover:text-primary-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              className="btn-primary w-full py-4 text-sm font-black uppercase tracking-widest group shadow-glow"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Initialize Node <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-6 border-t border-slate-800 text-center">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Already registered? <Link to="/login" className="text-primary-400 hover:text-primary-300 ml-1 transition-colors">Authorize Session</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
