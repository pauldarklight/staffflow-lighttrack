import { base44 } from '@/api/base44Client';

export default function Landing() {
  const handleLogin = () => {
    base44.auth.redirectToLogin('/Dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0a1a14] flex flex-col overflow-hidden relative">
      {/* Animated glow lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140%] h-[60%]"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(0,200,100,0.08) 0%, transparent 70%)',
          }}
        />
        <svg className="absolute bottom-0 left-0 w-full h-full opacity-20" viewBox="0 0 1440 600" preserveAspectRatio="none">
          <path d="M-100 500 Q400 200 900 350 Q1200 450 1600 250" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.6"/>
          <path d="M-100 520 Q400 230 900 380 Q1200 480 1600 280" stroke="#16a34a" strokeWidth="1" fill="none" opacity="0.4"/>
          <path d="M-100 480 Q350 180 850 320 Q1150 420 1600 220" stroke="#4ade80" strokeWidth="0.8" fill="none" opacity="0.3"/>
        </svg>
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0d2b1f] border border-[#22c55e]/30 rounded-lg flex items-center justify-center">
            <span className="text-[#22c55e] font-bold text-xl leading-none">d.</span>
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-none tracking-tight">dark light.</div>
            <div className="text-[#22c55e]/70 text-xs tracking-widest">humanizing data</div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-10 pb-16 max-w-2xl">
        {/* Greeting */}
        <div className="mb-8">
          <p className="text-[#22c55e] text-lg font-medium mb-1">Hey Paul & Adnane 👋</p>
          <h1 className="text-white text-5xl font-bold leading-tight tracking-tight mb-2">
            dark light<span className="text-[#22c55e]">.</span>
          </h1>
          <p className="text-white/40 text-base tracking-widest uppercase text-sm">humanizing data</p>
        </div>

        <div className="mb-10">
          <p className="text-white font-bold text-xl mb-1">Staffing & Consultancy</p>
          <div className="w-12 h-0.5 bg-[#22c55e] mb-3" />
          <p className="text-white/60 text-base italic">Data & Business Intelligence</p>
        </div>

        <button
          onClick={handleLogin}
          className="inline-flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-sm px-6 py-3 rounded-full transition-all duration-200 w-fit shadow-lg shadow-green-900/30 hover:shadow-green-800/40"
        >
          Toegang tot de app
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-10 py-4">
        <p className="text-white/20 text-xs">© {new Date().getFullYear()} Dark Light. All rights reserved.</p>
      </footer>
    </div>
  );
}