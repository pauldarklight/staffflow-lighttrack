import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'Dark-light123') {
      navigate('/Dashboard');
    } else {
      setError('Incorrect wachtwoord. Probeer opnieuw.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050f09] flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* Background grid — iets warmer/zachter */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Warme zijkant-glows om de koude randen te verzachten */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 80% at 0% 50%, rgba(34,197,94,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 100% 50%, rgba(34,197,94,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 50% 55%, rgba(34,197,94,0.10) 0%, transparent 70%)
          `,
        }}
      />

      {/* Arc lines */}
      <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 1440 800" preserveAspectRatio="none">
        <ellipse cx="720" cy="820" rx="900" ry="400" fill="none" stroke="#22c55e" strokeWidth="1" />
        <ellipse cx="720" cy="860" rx="700" ry="330" fill="none" stroke="#16a34a" strokeWidth="0.8" />
        <ellipse cx="720" cy="900" rx="500" ry="260" fill="none" stroke="#4ade80" strokeWidth="0.6" />
      </svg>

      {/* Top-left logo: dark light logo in wit */}
      <div className="absolute top-7 left-10 flex items-center gap-4 z-20">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl border border-white/20 bg-white/5">
          <span className="text-white font-black text-3xl leading-none tracking-tighter">d.</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-white font-black text-2xl tracking-tight">dark light.</span>
          <span className="text-white/40 text-[11px] uppercase tracking-widest">humanizing data</span>
        </div>
      </div>

      {/* Content */}
      <div
        className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center text-center px-10 sm:px-20 lg:px-32 transition-all duration-1000"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)' }}
      >
        {/* Greeting */}
        <p className="text-[#4ade80] font-bold tracking-wide mb-6" style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)' }}>
          Hey Paul & Adnane 👋
        </p>

        {/* Main title — LightTrack */}
        <h1 className="text-white font-black leading-none tracking-tighter mb-4 w-full" style={{ fontSize: 'clamp(4.5rem, 14vw, 11rem)' }}>
          Light<span className="text-[#22c55e]">Track</span>
        </h1>

        {/* Slogan */}
        <p className="text-white/55 font-light mb-8" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)' }}>
          The simple way to manage your backoffice.
        </p>

        {/* Divider */}
        <div className="w-16 h-px bg-[#22c55e]/40 mb-8" />

        {/* Powered by dark light */}
        <p className="text-white/25 text-xs uppercase tracking-widest mb-10">
          Powered by <span className="text-white/50 font-semibold">dark light.</span>
        </p>

        {/* Password form */}
        <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col items-center gap-3">
          <div className="relative w-full">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Wachtwoord"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              className="w-full bg-white/5 border border-white/15 text-white placeholder-white/30 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-[#22c55e]/60 focus:bg-white/8 transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-base px-10 py-3.5 rounded-full transition-all duration-200 shadow-xl shadow-green-900/40 hover:shadow-green-800/50 hover:scale-105"
          >
            <span>Inloggen</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>

      {/* Bottom brand strip */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <p className="text-white/15 text-xs tracking-widest uppercase">© {new Date().getFullYear()} Dark Light · LightTrack · All rights reserved</p>
      </div>
    </div>
  );
}