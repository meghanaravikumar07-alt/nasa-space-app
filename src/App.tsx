import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Brain,
  Database,
  Flame,
  Info,
  LayoutDashboard,
  Menu,
  RefreshCw,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LandingPage } from './components/LandingPage.tsx';
import { AboutProjectView } from './components/views/AboutProjectView.tsx';
import { AiIntelligenceView } from './components/views/AiIntelligenceView.tsx';
import { CombustionExplorerView } from './components/views/CombustionExplorerView.tsx';
import { MissionResearchView } from './components/views/MissionResearchView.tsx';
import { OverviewView } from './components/views/OverviewView.tsx';
import { RiskAssessmentView } from './components/views/RiskAssessmentView.tsx';
import { SimulationLabView } from './components/views/SimulationLabView.tsx';
import type { MlAnalysisResponse, OverviewPayload } from './types/combustion.ts';

type ViewId = 'overview' | 'explorer' | 'ai' | 'simulator' | 'risk' | 'research' | 'about';

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'explorer', label: 'Combustion Explorer', icon: Database },
  { id: 'ai', label: 'AI Intelligence', icon: Brain },
  { id: 'simulator', label: 'Simulation Lab', icon: Flame },
  { id: 'risk', label: 'Risk Assessment', icon: ShieldAlert },
  { id: 'research', label: 'Mission Research', icon: BookOpen },
  { id: 'about', label: 'About Project', icon: Info },
];

export default function App() {
  const [mode, setMode] = useState<'landing' | 'dashboard'>('landing');
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [analysis, setAnalysis] = useState<MlAnalysisResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const fetchCoreData = useCallback(async () => {
    try {
      const [ovRes, mlRes] = await Promise.all([fetch('/api/overview'), fetch('/api/ml/analysis')]);
      if (ovRes.ok) {
        setOverview((await ovRes.json()) as OverviewPayload);
      }
      if (mlRes.ok) {
        setAnalysis((await mlRes.json()) as MlAnalysisResponse);
      }
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoreData();
    // Auto-refresh dashboard connectivity & metrics every 60s
    const timer = setInterval(fetchCoreData, 60000);
    return () => clearInterval(timer);
  }, [fetchCoreData]);

  const handleSyncNasa = async () => {
    setSyncing(true);
    try {
      await fetch('/api/data/sync', { method: 'POST' });
      await fetchCoreData();
    } finally {
      setSyncing(false);
    }
  };

  const handleEnterDashboard = (targetView: ViewId = 'overview') => {
    setActiveView(targetView);
    setMode('dashboard');
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050B18] text-[#F8FAFC] orbital-grid-bg">
        <div className="text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-[#00D9FF]/30 border-t-[#00D9FF] animate-spin" />
          <p className="font-display text-lg font-bold tracking-wide">ORBITAL X</p>
          <p className="font-mono text-xs text-[#94A3B8]">
            Initializing SQLite combustion archive &amp; NASA OSDR telemetry...
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'landing') {
    return (
      <LandingPage
        overview={overview}
        onEnterDashboard={(v) => handleEnterDashboard(v || 'overview')}
      />
    );
  }

  const connectedCount = overview?.sources.filter((s) => s.status === 'CONNECTED').length ?? 0;
  const totalSources = overview?.sources.length ?? 6;
  const lastSyncStr = overview?.lastSyncAt
    ? new Date(overview.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Pending';

  return (
    <div className="min-h-screen bg-[#050B18] text-[#F8FAFC] flex flex-col">
      {/* Persistent Dashboard Top Bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-800 bg-[#050B18] px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden rounded p-1.5 text-[#94A3B8] hover:text-white cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={() => setMode('landing')}
            className="font-display text-base font-bold tracking-tight text-[#F8FAFC] hover:text-[#00D9FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ORBITAL X
          </button>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs font-mono-tabular text-[#94A3B8]">
          <span className={connectedCount > 0 ? 'text-[#22C55E]' : 'text-[#F59E0B]'}>
            ● Sources: {connectedCount}/{totalSources} Online
          </span>
          <span>Dataset Sync: {lastSyncStr}</span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSyncNasa}
            disabled={syncing}
            className="hidden sm:inline-flex items-center gap-1.5 rounded border border-slate-700 bg-[#0B1628] px-3 py-1.5 text-xs text-[#CBD5E1] hover:border-[#00D9FF]/60 hover:text-[#00D9FF] disabled:opacity-50 cursor-pointer"
            title="Synchronize NASA OSDR & PSI availability"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen(!notifOpen);
                setProfileOpen(false);
              }}
              className="rounded border border-slate-800 bg-[#0B1628] p-2 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              aria-label="System notifications and high-risk alerts"
            >
              <Bell className="h-4 w-4" />
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-700 bg-[#0B1628] p-4 shadow-xl z-40 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <span className="font-display font-semibold text-[#F8FAFC]">Telemetry &amp; Risk Feed</span>
                  <button type="button" onClick={() => setNotifOpen(false)} className="text-[#94A3B8] hover:text-white cursor-pointer">
                    Close
                  </button>
                </div>
                <div className="space-y-2.5">
                  <div className="rounded bg-[#050B18] p-2.5 border border-slate-800">
                    <p className="font-mono text-[#00D9FF]">NASA Repository Sync</p>
                    <p className="text-[#CBD5E1] mt-0.5">
                      {connectedCount}/{totalSources} endpoints reachable · Last check {lastSyncStr}
                    </p>
                  </div>
                  <div className="rounded bg-[#050B18] p-2.5 border border-slate-800">
                    <p className="font-mono text-[#F59E0B]">High-Risk Dataset Patterns</p>
                    <p className="text-[#CBD5E1] mt-0.5">
                      {overview?.metrics.detectedHighRiskCount ?? 0} experimental records exceed prototype flame spread / O2 threshold.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotifOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded border border-slate-800 bg-[#0B1628] px-2.5 py-1.5 text-xs text-[#CBD5E1] hover:text-white cursor-pointer"
              aria-label="Researcher workspace profile"
            >
              <User className="h-4 w-4 text-[#00D9FF]" />
              <span className="hidden sm:inline">Researcher</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-700 bg-[#0B1628] p-4 shadow-xl z-40 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-display font-semibold text-[#F8FAFC]">Mission Workspace</span>
                  <button type="button" onClick={() => setProfileOpen(false)} className="text-[#94A3B8] hover:text-white cursor-pointer">
                    Close
                  </button>
                </div>
                <p className="text-[#CBD5E1]">Role: Aerospace Combustion Analyst</p>
                <p className="font-mono text-[#94A3B8]">
                  DB: {overview?.backendHealth.databaseEngine ?? 'SQLite'}
                </p>
                <p className="font-mono text-[#94A3B8]">
                  Gemini AI: {overview?.backendHealth.geminiConfigured ? 'Configured' : 'Local Fallback Active'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setMode('landing');
                  }}
                  className="mt-2 w-full rounded border border-slate-700 py-1.5 text-center text-[#00D9FF] hover:bg-[#101D31] cursor-pointer"
                >
                  Return to Mission Landing
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Persistent Sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between border-r border-slate-800 bg-[#0B1628] p-4">
          <nav aria-label="Mission Control Sidebar" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#94A3B8] hover:bg-[#101D31] hover:text-[#F8FAFC]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="rounded-md border border-slate-800 bg-[#050B18] p-3 text-[11px] space-y-1.5">
            <div className="flex items-center gap-1.5 font-mono text-[#00D9FF]">
              <Activity className="h-3.5 w-3.5" />
              <span>Telemetry Active</span>
            </div>
            <p className="text-[#94A3B8] font-mono-tabular">
              {overview?.metrics.availableRecords ?? 0} validated runs loaded
            </p>
            <p className="text-[#94A3B8]">
              Prototype ML · Not NASA-certified
            </p>
          </div>
        </aside>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative z-50 w-64 bg-[#0B1628] border-r border-slate-800 p-4 flex flex-col justify-between">
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveView(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                        active ? 'bg-[#2563EB] text-white' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Workspace Content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-10">
          <div className="mx-auto max-w-[1280px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeView === 'overview' && (
                  <OverviewView
                    overview={overview}
                    syncing={syncing}
                    onSyncNasa={handleSyncNasa}
                    onNavigate={(v) => setActiveView(v)}
                  />
                )}
                {activeView === 'explorer' && (
                  <CombustionExplorerView onDatasetUpdated={fetchCoreData} />
                )}
                {activeView === 'ai' && <AiIntelligenceView />}
                {activeView === 'simulator' && <SimulationLabView />}
                {activeView === 'risk' && (
                  <RiskAssessmentView
                    analysis={analysis}
                    totalRecords={overview?.metrics.availableRecords ?? 0}
                  />
                )}
                {activeView === 'research' && (
                  <MissionResearchView onSyncNasa={handleSyncNasa} syncing={syncing} />
                )}
                {activeView === 'about' && <AboutProjectView />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
