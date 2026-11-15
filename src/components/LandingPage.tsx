import { ArrowRight, Database, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import type { OverviewPayload } from '../types/combustion.ts';
import { OrbitalHeroScene } from './three/OrbitalHeroScene.tsx';

interface LandingPageProps {
  overview: OverviewPayload | null;
  onEnterDashboard: (initialView?: 'overview' | 'explorer' | 'simulator' | 'research' | 'about') => void;
}

export function LandingPage({ overview, onEnterDashboard }: LandingPageProps) {
  const connectedSources =
    overview?.sources.filter((s) => s.status === 'CONNECTED').length ?? 0;
  const totalSources = overview?.sources.length ?? 6;
  const lastSyncFormatted = overview?.lastSyncAt
    ? new Date(overview.lastSyncAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Initializing';

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050B18] text-[#F8FAFC] flex flex-col justify-between">
      {/* Interactive Three.js 3D Earth, Orbital Spacecraft & Spherical Flame */}
      <OrbitalHeroScene />

      {/* Subtle directional gradient scrim ensuring high text legibility over 3D viewport */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050B18]/95 via-[#050B18]/72 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 orbital-grid-bg opacity-25"
        aria-hidden="true"
      />

      {/* 3-Zone Top Navigation Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between gap-8 border-b border-slate-800/70 bg-[#050B18]/85 px-6 py-4 md:px-12">
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-[#F8FAFC] whitespace-nowrap shrink-0"
        >
          ORBITAL X
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#94A3B8]">
          <button
            type="button"
            onClick={() => onEnterDashboard('overview')}
            className="hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Mission Control
          </button>
          <button
            type="button"
            onClick={() => onEnterDashboard('explorer')}
            className="hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Data Explorer
          </button>
          <button
            type="button"
            onClick={() => onEnterDashboard('simulator')}
            className="hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Combustion Lab
          </button>
          <button
            type="button"
            onClick={() => onEnterDashboard('research')}
            className="hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            NASA Research
          </button>
          <button
            type="button"
            onClick={() => onEnterDashboard('about')}
            className="hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            About
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => onEnterDashboard('overview')}
            className="inline-flex items-center gap-2 rounded-md bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 items-center px-6 py-12 md:px-12">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="font-mono text-xs font-medium tracking-[0.16em] text-[#00D9FF] uppercase mb-4">
              Advanced space fire intelligence system
            </p>

            <h1
              className="font-display font-bold tracking-tight text-[#F8FAFC] mb-5"
              style={{ fontSize: 'clamp(2.5rem, 4.8vw, 4.25rem)', lineHeight: 1.06, textWrap: 'balance' }}
            >
              Flame in Freefall
            </h1>

            <p className="text-base md:text-lg leading-relaxed text-[#CBD5E1] max-w-xl mb-8">
              Fire behaves differently beyond Earth&apos;s gravity. ORBITAL X transforms microgravity combustion
              research into actionable intelligence for safer human space exploration.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-10">
              <button
                type="button"
                onClick={() => onEnterDashboard('overview')}
                className="inline-flex items-center gap-2.5 rounded-md bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Explore Mission</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => onEnterDashboard('explorer')}
                className="inline-flex items-center gap-2.5 rounded-md border border-slate-700 bg-[#0B1628]/90 px-6 py-3 text-sm font-semibold text-[#F8FAFC] hover:border-[#00D9FF]/60 hover:text-[#00D9FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Database className="h-4 w-4 text-[#00D9FF]" />
                <span>View Scientific Data</span>
              </button>
            </div>

            {/* Three compact unboxed capability indicators */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800/90 pt-5 text-xs font-mono tracking-wider text-[#94A3B8]">
              <span className="text-[#F8FAFC]">MICROGRAVITY RESEARCH</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-[#F8FAFC]">AI COMBUSTION ANALYSIS</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-[#F8FAFC]">SPACECRAFT FIRE SAFETY</span>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Bottom Real Mission Status & Dataset Connectivity Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#050B18]/90 px-6 py-3.5 md:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 text-xs text-[#94A3B8]">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono-tabular">
            <span className="text-[#22C55E]">
              ● Backend API: {overview?.backendHealth.apiStatus ?? 'CONNECTING'}
            </span>
            <span>
              NASA Sources Online: <strong className="text-[#F8FAFC]">{connectedSources}/{totalSources}</strong>
            </span>
            <span>
              Active Records: <strong className="text-[#F8FAFC]">{overview?.metrics.availableRecords ?? '—'}</strong>
            </span>
            <span>
              Last Sync: <strong className="text-[#F8FAFC]">{lastSyncFormatted}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <ShieldAlert className="h-3.5 w-3.5 text-[#F59E0B]" />
            <span>Research intelligence platform · Historical NASA data + prototype ML</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
