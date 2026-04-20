import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(4);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/Dashboard');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  return (
    <div className="min-h-screen bg-[#050f09] flex flex-col items-center justify-center relative overflow-hidden select-none">

      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Green radial glow center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 55%, rgba(34,197,94,0.10) 0%, transparent 70%)',
        }}
      />

      {/* Animated arc lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 1440 800" preserveAspectRatio="none">
        <ellipse cx="720" cy="820" rx="900" ry="400" fill="none" stroke="#22c55e" strokeWidth="1" />
        <ellipse cx="720" cy="860" rx="700" ry="330" fill="none" stroke="#16a34a" strokeWidth="0.8" />
        <ellipse cx="720" cy="900" rx="500" ry="260" fill="none" stroke="#4ade80" strokeWidth="0.6" />
      </svg>

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-6 transition-all duration-1000"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)' }}
      >
        {/* Logo mark */}
        <div className="mb-10 flex items-center justify-center w-20 h-20 rounded-2xl border border-[#22c55e]/20 bg-[#0a1a10]/80 shadow-lg shadow-green-950/40">
          <span className="text-[#22c55e] font-black text-4xl leading-none tracking-tighter">d.</span>
        </div>

        {/* Greeting */}
        <p className="text-[#4ade80] text-xl font-medium tracking-wide mb-4">
          Hey Paul & Adnane 👋
        </p>

        {/* Main title */}
        <h1 className="text-white font-black leading-none tracking-tighter mb-2" style={{ fontSize: 'clamp(4rem, 12vw, 9rem)' }}>
          dark light<span className="text-[#22c55e]">.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-white/30 uppercase tracking-[0.4em] text-sm font-light mb-2">
          humanizing data
        </p>

        {/* Divider */}
        <div className="w-16 h-px bg-[#22c55e]/40 my-6" />

        {/* Tag lines */}
        <p className="text-white/70 text-xl font-semibold mb-1">Staffing & Consultancy</p>
        <p className="text-white/40 text-base italic mb-12">Data & Business Intelligence</p>

        {/* CTA + countdown */}
        <button
          onClick={() => navigate('/Dashboard')}
          className="group relative inline-flex items-center gap-3 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-base px-8 py-4 rounded-full transition-all duration-200 shadow-xl shadow-green-900/40 hover:shadow-green-800/50 hover:scale-105"
        >
          <span>Naar het dashboard</span>
          <span className="w-7 h-7 rounded-full bg-black/15 flex items-center justify-center text-sm font-black tabular-nums">
            {countdown}
          </span>
        </button>

        <p className="text-white/20 text-xs mt-4">Automatisch doorgestuurd in {countdown}s</p>
      </div>

      {/* Bottom brand strip */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <p className="text-white/15 text-xs tracking-widest uppercase">© {new Date().getFullYear()} Dark Light · All rights reserved</p>
      </div>
    </div>
  );
}