import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, ArrowRight, Loader2, Sparkles, Target } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const navigate = useNavigate();

  const taglines = [
    "PLAN FOR SUCCESS",
    "DRIVE EXCELLENCE",
    "EMPOWER EDUCATION",
    "STREAMLINE MANAGEMENT",
    "INNOVATE TOGETHER",
    "GOVERN WITH PRECISION"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    navigate('/');
  };

  return (
    <div className="h-dvh w-screen overflow-hidden bg-slate-950 font-sans relative flex flex-col md:flex-row">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-aurora-cyan/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-aurora-violet/20 rounded-full blur-[120px]"></div>
      </div>

      {/* Left Section: Glassmorphism Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-12 relative z-10 bg-slate-950 h-full overflow-hidden">
        <div className="w-full max-w-md space-y-4 sm:space-y-6 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-2xl p-6 sm:p-8 lg:p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 animate-in fade-in slide-in-from-left-10 duration-1000">
          <div className="text-center md:text-left">
            <div className="mx-auto md:mx-0 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-aurora-cyan to-aurora-violet rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-glow transition-transform hover:scale-110 duration-500">
              <GraduationCap className="text-white" size={32} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">Sign In</h1>
            <p className="mt-1 sm:mt-2 text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-[0.25em]">
              Authorized Personnel Only
            </p>
          </div>
          
          <form className="mt-4 sm:mt-6 space-y-4 sm:space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-2xl bg-rose-500/10 p-3 text-[9px] text-rose-400 border border-rose-500/20 font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                {error}
              </div>
            )}
            
            <div className="space-y-4 sm:space-y-5">
              <div className="group">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1 group-focus-within:text-aurora-cyan transition-colors">
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@edutrack.ug"
                  className="w-full rounded-2xl border border-white/5 px-4 sm:px-6 py-3 sm:py-4 focus:ring-2 focus:ring-aurora-cyan/30 focus:border-aurora-cyan outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm sm:text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              
              <div className="relative group">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1 group-focus-within:text-aurora-violet transition-colors">
                  Security Token
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-white/5 px-4 sm:px-6 py-3 sm:py-4 focus:ring-2 focus:ring-aurora-violet/30 focus:border-aurora-violet outline-none transition-all duration-300 bg-white/[0.02] text-white placeholder:text-slate-600 font-bold text-sm sm:text-base"
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
                className="w-full bg-gradient-to-r from-aurora-cyan to-aurora-violet py-4 sm:py-5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Initialize Session <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="pt-4 sm:pt-6 border-t border-white/5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Staff member? <Link to="/register" className="text-aurora-cyan hover:text-white ml-1 transition-colors">Onboard here</Link>
              </p>
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">v2.0.4-LTS</span>
            </div>
            
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 group hover:border-aurora-cyan/30 transition-all">
              <div>
                <p className="text-[9px] font-black text-white uppercase tracking-widest">New Institution?</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Register your school to get started</p>
              </div>
              <Link to="/setup-school" className="text-[9px] font-black text-aurora-cyan uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                Register School <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section: Minimalist Midnight Blue Branding */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden h-full border-l border-white/5">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="relative z-10 text-center space-y-8 lg:space-y-12 w-full px-8">
          <div className="space-y-4">
            <h2 className="text-5xl lg:text-7xl font-black text-white tracking-tighter animate-in fade-in slide-in-from-bottom-10 duration-1000">
              EDU<span className="text-transparent bg-clip-text bg-gradient-to-r from-aurora-cyan to-aurora-violet">TRACK</span> UG
            </h2>
            <div className="h-1 w-24 lg:w-32 bg-gradient-to-r from-aurora-cyan to-aurora-violet mx-auto rounded-full shadow-glow"></div>
          </div>
          
          <div className="h-24 lg:h-32 flex items-center justify-center overflow-hidden">
            <div className="relative w-full h-full flex items-center justify-center">
              {taglines.map((text, index) => (
                <p 
                  key={index}
                  className={`absolute text-2xl lg:text-4xl font-black uppercase tracking-[0.4em] transition-all duration-1000 ease-in-out text-transparent bg-clip-text bg-gradient-to-r from-aurora-cyan via-white to-aurora-violet text-center px-4 w-full
                    ${index === taglineIndex 
                      ? 'opacity-100 translate-y-0 blur-none' 
                      : 'opacity-0 translate-y-12 blur-md'}`}
                >
                  {text}
                </p>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 lg:gap-12 pt-8 lg:pt-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-aurora-cyan shadow-neon-cyan transition-transform hover:scale-110 duration-500">
                <Sparkles size={24} />
              </div>
              <span className="text-[8px] lg:text-[9px] font-black text-slate-600 uppercase tracking-widest">Intelligent</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-aurora-violet shadow-neon-violet transition-transform hover:scale-110 duration-500">
                <Target size={24} />
              </div>
              <span className="text-[8px] lg:text-[9px] font-black text-slate-600 uppercase tracking-widest">Precise</span>
            </div>
          </div>
        </div>

        {/* Floating subtle ambient glows */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-aurora-cyan/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-aurora-violet/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>
      </div>
    </div>
  );
};

export default Login;
