import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

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
        <p className="text-[#4ade80] text-xl font-medium tracking-wide mb-4">
          Hey Paul & Adnane 👋
        </p>

        {/* Main title */}
        <h1 className="text-white font-black leading-none tracking-tighter mb-2 w-full" style={{ fontSize: 'clamp(4.5rem, 14vw, 11rem)' }}>
          dark light<span className="text-[#22c55e]">.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-white/30 uppercase tracking-[0.4em] text-sm font-light mb-2">
          humanizing data
        </p>

        {/* Divider */}
        <div className="w-16 h-px bg-[#22c55e]/40 my-6" />

        {/* LightTrack tag */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white/50 text-xs uppercase tracking-widest">powered by</span>
          <span className="text-white font-bold text-sm tracking-tight border border-white/15 rounded-full px-3 py-0.5 bg-white/5">
            LightTrack
          </span>
        </div>

        {/* Tag lines */}
        <p className="text-white/70 text-xl font-semibold mb-1 mt-3">Staffing & Consultancy</p>
        <p className="text-white/40 text-base italic mb-12">Data & Business Intelligence</p>

        {/* CTA */}
        <button
          onClick={() => navigate('/Dashboard')}
          className="inline-flex items-center gap-3 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-base px-10 py-4 rounded-full transition-all duration-200 shadow-xl shadow-green-900/40 hover:shadow-green-800/50 hover:scale-105"
        >
          <span>Inloggen</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bottom brand strip */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <p className="text-white/15 text-xs tracking-widest uppercase">© {new Date().getFullYear()} Dark Light · LightTrack · All rights reserved</p>
      </div>
    </div>
  );
}