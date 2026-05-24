import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, ArrowRight, Loader2, CheckCircle2, User, Users } from 'lucide-react';

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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 font-sans relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-700 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md space-y-8 rounded-[2.5rem] bg-slate-900 p-8 sm:p-10 shadow-2xl shadow-black/50 border border-slate-800 relative z-10">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mb-6 shadow-glow">
            {role === 'teacher' ? <GraduationCap className="text-white" size={32} /> : <Users className="text-white" size={32} />}
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {role === 'teacher' ? 'Staff Onboarding' : 'Guardian Portal'}
          </h1>
          <p className="mt-3 text-sm text-slate-500 font-medium tracking-tight uppercase tracking-widest">
            {role === 'teacher' ? 'Institutional Initialization' : 'Community Connectivity'}
          </p>
        </div>

        {!message && (
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setRole('teacher')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                role === 'teacher' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <User size={14} /> Staff
            </button>
            <button
              onClick={() => setRole('parent')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                role === 'parent' ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users size={14} /> Parent
            </button>
          </div>
        )}

        {message ? (
          <div className="bg-emerald-500/10 text-emerald-400 p-8 rounded-3xl border border-emerald-500/20 text-center animate-in zoom-in duration-500 shadow-emerald-glow">
            <div className="mx-auto w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h2 className="text-xl font-black mb-2">Registration Success</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              {message}
            </p>
            <div className="space-y-3">
              <a href="/login" className="btn-primary w-full py-3 inline-block">
                Return to Login
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-4">
              {role === 'parent' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your full name"
                      className="input-field"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                      Registered Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Phone linked to your child"
                      className="input-field"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder={role === 'teacher' ? "Authorized staff email" : "Your personal email"}
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">
                  Access Key (Password)
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
                  {role === 'teacher' ? 'Initialize Node' : 'Request Access'} 
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-6 border-t border-slate-800 text-center">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Already have an account? <Link to="/login" className="text-primary-400 hover:text-primary-300 ml-1 transition-colors">Authorize Session</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
