import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { InvestigationProfile, OverviewPayload } from '../../types/combustion.ts';
import { FlameSimulator3D } from '../three/FlameSimulator3D.tsx';

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const duration = 550;
    let raf = 0;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className="font-mono-tabular">
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
    </span>
  );
}

interface OverviewViewProps {
  overview: OverviewPayload | null;
  syncing: boolean;
  onSyncNasa: () => Promise<void>;
  onNavigate: (view: 'explorer' | 'ai' | 'simulator' | 'risk' | 'research') => void;
}

export function OverviewView({ overview, syncing, onSyncNasa, onNavigate }: OverviewViewProps) {
  const [selectedExp, setSelectedExp] = useState<InvestigationProfile | null>(null);
  const [gravityMode, setGravityMode] = useState<'0g' | '1g'>('0g');

  const investigations = overview?.investigations ?? [];
  const activeExp = selectedExp || investigations[0] || null;

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#00D9FF] mb-1">
            Mission Control Telemetry
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F8FAFC]">
            Combustion Intelligence Center
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSyncNasa}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-[#101D31] px-4 py-2 text-xs font-semibold text-[#F8FAFC] hover:border-[#00D9FF]/60 hover:text-[#00D9FF] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Synchronizing NASA Feeds...' : 'Sync NASA Sources'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('explorer')}
            className="rounded-md bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Explore Datasets
          </button>
        </div>
      </div>

      {/* 4 Calculated Scientific Metric Cards (from SQLite DB) */}
      <section aria-label="Calculated dataset metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
            Experiments Analysed
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#F8FAFC]">
              <AnimatedNumber value={overview?.metrics.experimentsAnalysed ?? 0} />
            </span>
            <span className="font-mono text-xs text-[#00D9FF]">NASA / Matched</span>
          </div>
          <p className="mt-2 text-xs text-[#94A3B8]">
            Distinct flight &amp; baseline campaigns in SQLite store
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
            Available Combustion Records
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#F8FAFC]">
              <AnimatedNumber value={overview?.metrics.availableRecords ?? 0} />
            </span>
            <span className="font-mono text-xs text-[#94A3B8]">runs</span>
          </div>
          <p className="mt-2 text-xs text-[#94A3B8] font-mono-tabular">
            {overview?.metrics.microgravityRecords ?? 0} microgravity · {overview?.metrics.earthComparisonRecords ?? 0} 1g baseline
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
            Average Flame Spread Rate
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#00D9FF]">
              <AnimatedNumber value={overview?.metrics.avgFlameSpreadMmS ?? 0} decimals={2} />
            </span>
            <span className="font-mono text-xs text-[#94A3B8]">mm/s</span>
          </div>
          <p className="mt-2 text-xs text-[#94A3B8]">
            Computed mean across validated flame spread runs
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8]">
            Detected High-Risk Conditions
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#F59E0B]">
              <AnimatedNumber value={overview?.metrics.detectedHighRiskCount ?? 0} />
            </span>
            <span className="font-mono text-xs text-[#EF4444]">Prototype Flag</span>
          </div>
          <p className="mt-2 text-xs text-[#94A3B8]">
            Runs exceeding prototype spread/O2 index thresholds
          </p>
        </div>
      </section>

      {/* Main Split: Experiment Monitor (Left) + Conceptual Combustion Environment (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* A. Experiment Monitor */}
        <section className="lg:col-span-6 rounded-lg border border-slate-800 bg-[#0B1628] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                A. Experiment Monitor
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('research')}
                className="text-xs font-medium text-[#00D9FF] hover:underline cursor-pointer"
              >
                Open Full Library
              </button>
            </div>

            {/* Segmented Experiment Tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-md bg-[#050B18] p-1 border border-slate-800 mb-5">
              {investigations.map((inv) => {
                const active = activeExp?.id === inv.id;
                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => setSelectedExp(inv)}
                    className={`px-3 py-1.5 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {inv.code}
                  </button>
                );
              })}
            </div>

            {activeExp && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-base font-semibold text-[#F8FAFC]">
                    {activeExp.name}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-[#94A3B8]">
                    {activeExp.facility} · {activeExp.gravityEnvironment} · {activeExp.datasetIdentifier}
                  </p>
                </div>

                <p className="text-sm leading-relaxed text-[#CBD5E1]">
                  {activeExp.objective}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-xs">
                  <div>
                    <p className="font-mono uppercase tracking-wider text-[#94A3B8] mb-1">
                      Fuels &amp; Materials
                    </p>
                    <p className="text-[#F8FAFC] leading-relaxed">
                      {activeExp.fuelMaterials.join(' · ')}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono uppercase tracking-wider text-[#94A3B8] mb-1">
                      Experimental Parameters
                    </p>
                    <p className="text-[#F8FAFC] leading-relaxed">
                      {activeExp.keyParameters.slice(0, 3).join(' · ')}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 text-xs">
                  <p className="font-mono uppercase tracking-wider text-[#94A3B8] mb-1">
                    Data Availability
                  </p>
                  <p className="text-[#22C55E]">{activeExp.dataAvailability}</p>
                </div>
              </div>
            )}
          </div>

          {activeExp && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <a
                href={activeExp.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00D9FF] hover:underline"
              >
                <span>Official NASA Reference</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onNavigate('explorer')}
                className="text-xs font-medium text-[#F8FAFC] hover:text-[#00D9FF] cursor-pointer"
              >
                Filter {activeExp.code} Records →
              </button>
            </div>
          )}
        </section>

        {/* B. Combustion Environment (Conceptual Simulation) */}
        <section className="lg:col-span-6 rounded-lg border border-slate-800 bg-[#0B1628] p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                  B. Combustion Environment
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Conceptual 3D physics-approximated visualization · Not actual ISS imagery
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-md bg-[#050B18] p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setGravityMode('0g')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    gravityMode === '0g'
                      ? 'bg-[#00D9FF]/20 text-[#00D9FF] border border-[#00D9FF]/40'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  Microgravity (~0g)
                </button>
                <button
                  type="button"
                  onClick={() => setGravityMode('1g')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    gravityMode === '1g'
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  Earth Gravity (1g)
                </button>
              </div>
            </div>

            <FlameSimulator3D
              heightClass="h-[270px]"
              params={{
                gravityG: gravityMode === '0g' ? 0.0 : 1.0,
                oxygenPct: 21.0,
                pressureKpa: 101.3,
                airflowCmS: gravityMode === '0g' ? 2.0 : 0.0,
                fuelTempK: 350,
                fuelType: 'n-Heptane / Solid Polymer Reference',
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-slate-800 pt-4 text-xs">
            <div>
              <span className="font-mono text-[#94A3B8] block">Flame Morphology</span>
              <span className="text-[#F8FAFC] font-medium">
                {gravityMode === '0g' ? 'Spherical diffusion shell' : 'Elongated buoyant plume'}
              </span>
            </div>
            <div>
              <span className="font-mono text-[#94A3B8] block">Heat &amp; Oxidizer</span>
              <span className="text-[#F8FAFC] font-medium">
                {gravityMode === '0g' ? 'Diffusion-governed (21% O2)' : 'Natural convection (~30 cm/s)'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="font-mono text-[#94A3B8] block">Smoke Products</span>
              <span className="text-[#F8FAFC] font-medium">
                {gravityMode === '0g' ? 'Radial soot shell / drift' : 'Rising thermal plume'}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* C. System Status & Real NASA Connectivity */}
      <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
              C. System &amp; Scientific Data Source Status
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Live backend health monitoring &amp; NASA repository availability checks (historical experimental data clearly labeled)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular">
            <span className="text-[#22C55E]">● API: {overview?.backendHealth.apiStatus ?? 'ONLINE'}</span>
            <span className="text-[#00D9FF]">● ML Engine: {overview?.backendHealth.mlEngineStatus ?? 'READY'}</span>
            <span className="text-[#94A3B8]">
              OSDR Studies Indexed: <strong className="text-[#F8FAFC]">{overview?.osdrStudiesCount ?? 0}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 font-mono uppercase tracking-wider text-[#94A3B8]">
                <th className="py-2.5 pr-4">Data Source</th>
                <th className="py-2.5 pr-4">Status</th>
                <th className="py-2.5 pr-4">HTTP / Latency</th>
                <th className="py-2.5 pr-4">Last Success</th>
                <th className="py-2.5">Telemetry Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(overview?.sources ?? []).map((src) => (
                <tr key={src.id} className="hover:bg-[#101D31]/60 transition-colors">
                  <td className="py-3 pr-4 font-medium text-[#F8FAFC]">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#00D9FF] inline-flex items-center gap-1"
                    >
                      <span>{src.name}</span>
                      <ExternalLink className="h-3 w-3 text-[#94A3B8]" />
                    </a>
                  </td>
                  <td className="py-3 pr-4 font-mono">
                    {src.status === 'CONNECTED' ? (
                      <span className="text-[#22C55E]">● Connected</span>
                    ) : src.status === 'DEGRADED' ? (
                      <span className="text-[#F59E0B]">▲ Degraded</span>
                    ) : (
                      <span className="text-[#EF4444]">✖ Offline</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono-tabular text-[#CBD5E1]">
                    {src.httpStatus ?? '—'} · {src.latencyMs !== null ? `${src.latencyMs} ms` : '—'}
                  </td>
                  <td className="py-3 pr-4 font-mono-tabular text-[#94A3B8]">
                    {src.lastSuccessAt
                      ? new Date(src.lastSuccessAt).toLocaleTimeString()
                      : 'Cached archive'}
                  </td>
                  <td className="py-3 text-[#94A3B8]">{src.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
