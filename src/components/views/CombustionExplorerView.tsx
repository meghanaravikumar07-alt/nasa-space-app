import { useEffect, useMemo, useState } from 'react';
import { Download, Info, Search, Upload, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { CombustionRecord } from '../../types/combustion.ts';

interface Facets {
  experiments: string[];
  gravityConditions: string[];
  fuelTypes: string[];
  conditions: string[];
  hasOxygen: boolean;
  hasPressure: boolean;
  hasAirflow: boolean;
  hasFuelTemp: boolean;
  hasHeatRelease: boolean;
  hasExtinction: boolean;
  hasIgnitionDelay: boolean;
}

const DATASET_OPTIONS = [
  { id: 'ALL', label: 'All Curated & Uploaded Datasets' },
  { id: 'FLEX', label: 'FLEX — Droplet Extinguishment (PSI-69)' },
  { id: 'FLEX-2', label: 'FLEX-2 — Multi-Component Droplets (PSI-106)' },
  { id: 'SoFIE', label: 'SoFIE — Solid Fuel Ignition & Extinction' },
  { id: 'SoFIE-GEL', label: 'SoFIE-GEL — Growth & Extinction Limit' },
  { id: 'Saffire', label: 'Saffire — Cygnus Large-Scale Fires (PSI-98)' },
  { id: 'COMPARATIVE_1G_0G', label: 'Comparative Subset: Earth 1g vs Microgravity ~0g' },
];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Record<string, unknown> }> }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as Partial<CombustionRecord>;
  return (
    <div className="rounded-md border border-slate-700 bg-[#050B18] p-3 text-xs shadow-lg max-w-xs">
      <p className="font-display font-semibold text-[#F8FAFC]">
        {row.experimentName} · {row.fuelType}
      </p>
      <p className="font-mono text-[11px] text-[#00D9FF] mb-1.5">
        {row.gravityCondition} · {row.datasetId}
      </p>
      <div className="space-y-0.5 font-mono-tabular text-[#CBD5E1]">
        <div>O2: {row.oxygenPct}% · P: {row.pressureKpa} kPa · Flow: {row.airflowCmS} cm/s</div>
        <div>Fuel Temp: {row.fuelTempK} K</div>
        {row.flameSpreadMmS !== null && row.flameSpreadMmS !== undefined && (
          <div className="text-[#00D9FF]">Spread Rate: {row.flameSpreadMmS} mm/s</div>
        )}
        {row.ignitionDelayS !== null && row.ignitionDelayS !== undefined && (
          <div>Ignition Delay: {row.ignitionDelayS} s</div>
        )}
        {row.extinctionO2Pct !== null && row.extinctionO2Pct !== undefined && (
          <div>Extinction O2: {row.extinctionO2Pct}% vol</div>
        )}
        {row.heatReleaseKwM2 !== null && row.heatReleaseKwM2 !== undefined && (
          <div className="text-[#F59E0B]">Heat Release: {row.heatReleaseKwM2} kW/m²</div>
        )}
      </div>
    </div>
  );
}

export function CombustionExplorerView({ onDatasetUpdated }: { onDatasetUpdated: () => Promise<void> }) {
  const [selectedDataset, setSelectedDataset] = useState('ALL');
  const [records, setRecords] = useState<CombustionRecord[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Conditional filters
  const [expFilter, setExpFilter] = useState('ALL');
  const [gravityFilter, setGravityFilter] = useState('ALL');
  const [fuelFilter, setFuelFilter] = useState('ALL');
  const [minO2, setMinO2] = useState(14);
  const [maxPressure, setMaxPressure] = useState(130);
  const [minAirflow, setMinAirflow] = useState(0);
  const [minFuelTemp, setMinFuelTemp] = useState(280);
  const [conditionSearch, setConditionSearch] = useState('');

  // 1g vs 0g comparison focus fuel
  const [compareFuel, setCompareFuel] = useState('ALL');

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFormat, setUploadFormat] = useState<'csv' | 'json'>('csv');
  const [uploadText, setUploadText] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const loadDataset = async (datasetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/records?dataset=${encodeURIComponent(datasetId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { records: CombustionRecord[]; availableFacets: Facets };
      setRecords(data.records);
      setFacets(data.availableFacets);
      setExpFilter('ALL');
      setGravityFilter('ALL');
      setFuelFilter('ALL');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch combustion records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataset(selectedDataset);
  }, [selectedDataset]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (expFilter !== 'ALL' && r.experimentName !== expFilter) return false;
      if (gravityFilter !== 'ALL' && r.gravityCondition !== gravityFilter) return false;
      if (fuelFilter !== 'ALL' && r.fuelType !== fuelFilter) return false;
      if (r.oxygenPct < minO2) return false;
      if (r.pressureKpa > maxPressure) return false;
      if (r.airflowCmS < minAirflow) return false;
      if (r.fuelTempK < minFuelTemp) return false;
      if (
        conditionSearch.trim() &&
        !`${r.experimentalCondition} ${r.fuelType} ${r.ignitionOutcome}`
          .toLowerCase()
          .includes(conditionSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [records, expFilter, gravityFilter, fuelFilter, minO2, maxPressure, minAirflow, minFuelTemp, conditionSearch]);

  const microRecords = useMemo(() => filtered.filter((r) => r.gravityG < 0.05), [filtered]);
  const earthRecords = useMemo(() => filtered.filter((r) => r.gravityG >= 0.8), [filtered]);

  // Comparison stats (1g vs ~0g)
  const comparisonStats = useMemo(() => {
    const scope =
      compareFuel === 'ALL'
        ? filtered
        : filtered.filter((r) => r.fuelType === compareFuel);
    const m = scope.filter((r) => r.gravityG < 0.05);
    const e = scope.filter((r) => r.gravityG >= 0.8);
    const avg = (arr: (number | null)[]) => {
      const nums = arr.filter((v): v is number => v !== null && Number.isFinite(v));
      return nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : null;
    };
    return {
      microCount: m.length,
      earthCount: e.length,
      microSpread: avg(m.map((r) => r.flameSpreadMmS)),
      earthSpread: avg(e.map((r) => r.flameSpreadMmS)),
      microDelay: avg(m.map((r) => r.ignitionDelayS)),
      earthDelay: avg(e.map((r) => r.ignitionDelayS)),
      microExtO2: avg(m.map((r) => r.extinctionO2Pct)),
      earthExtO2: avg(e.map((r) => r.extinctionO2Pct)),
      microHeat: avg(m.map((r) => r.heatReleaseKwM2)),
      earthHeat: avg(e.map((r) => r.heatReleaseKwM2)),
    };
  }, [filtered, compareFuel]);

  // Fuels that actually have BOTH 1g and 0g records for apples-to-apples comparison
  const comparableFuels = useMemo(() => {
    const fuels = [...new Set(filtered.map((r) => r.fuelType))];
    return fuels.filter(
      (f) =>
        filtered.some((r) => r.fuelType === f && r.gravityG < 0.05) &&
        filtered.some((r) => r.fuelType === f && r.gravityG >= 0.8)
    );
  }, [filtered]);

  const handleLoadSampleCsv = async () => {
    const res = await fetch('/api/sample-csv');
    if (res.ok) {
      setUploadFormat('csv');
      setUploadText(await res.text());
    }
  };

  const handleUploadSubmit = async () => {
    setUploadStatus('Validating & storing dataset...');
    try {
      const res = await fetch('/api/data/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: uploadText,
          format: uploadFormat,
          sourceLabel: 'Researcher Uploaded CSV/JSON',
        }),
      });
      const json = (await res.json()) as {
        insertedCount?: number;
        rejectedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setUploadStatus(`Error: ${json.error || 'Upload rejected'}`);
        return;
      }
      setUploadStatus(`Imported ${json.insertedCount} validated records (${json.rejectedCount ?? 0} rejected).`);
      await loadDataset(selectedDataset);
      await onDatasetUpdated();
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header + Dataset Selector */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#00D9FF] mb-1">
            Interactive Scientific Data Explorer
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F8FAFC]">
            Combustion Data Explorer
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select experimental dataset"
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            className="rounded-md border border-slate-700 bg-[#0B1628] px-3 py-2 text-xs font-medium text-[#F8FAFC] focus:border-[#00D9FF] focus:outline-none"
          >
            {DATASET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-[#101D31] px-4 py-2 text-xs font-semibold text-[#F8FAFC] hover:border-[#00D9FF]/60 hover:text-[#00D9FF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV / JSON</span>
          </button>
        </div>
      </div>

      {/* Dynamic Conditional Filters (shown strictly when fields exist in selected dataset) */}
      {facets && (
        <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
              Dataset Parameter Filters
            </h2>
            <div className="flex items-center gap-4 text-xs font-mono-tabular text-[#94A3B8]">
              <span>
                Showing <strong className="text-[#00D9FF]">{filtered.length}</strong> of {records.length} records
              </span>
              <button
                type="button"
                onClick={() => {
                  setExpFilter('ALL');
                  setGravityFilter('ALL');
                  setFuelFilter('ALL');
                  setMinO2(14);
                  setMaxPressure(130);
                  setMinAirflow(0);
                  setMinFuelTemp(280);
                  setConditionSearch('');
                }}
                className="text-[#00D9FF] hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {facets.experiments.length > 1 && (
              <div>
                <label className="block font-mono text-[#94A3B8] mb-1">Experiment Name</label>
                <select
                  value={expFilter}
                  onChange={(e) => setExpFilter(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-[#050B18] px-2.5 py-2 text-[#F8FAFC]"
                >
                  <option value="ALL">All Experiments ({facets.experiments.length})</option>
                  {facets.experiments.map((ex) => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>
            )}

            {facets.gravityConditions.length > 1 && (
              <div>
                <label className="block font-mono text-[#94A3B8] mb-1">Gravity Condition</label>
                <select
                  value={gravityFilter}
                  onChange={(e) => setGravityFilter(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-[#050B18] px-2.5 py-2 text-[#F8FAFC]"
                >
                  <option value="ALL">All Gravity Regimes</option>
                  {facets.gravityConditions.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}

            {facets.fuelTypes.length > 1 && (
              <div>
                <label className="block font-mono text-[#94A3B8] mb-1">Fuel / Material Type</label>
                <select
                  value={fuelFilter}
                  onChange={(e) => setFuelFilter(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-[#050B18] px-2.5 py-2 text-[#F8FAFC]"
                >
                  <option value="ALL">All Fuel Types ({facets.fuelTypes.length})</option>
                  {facets.fuelTypes.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            )}

            {facets.conditions.length > 0 && (
              <div>
                <label className="block font-mono text-[#94A3B8] mb-1">Condition / Outcome Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={conditionSearch}
                    onChange={(e) => setConditionSearch(e.target.value)}
                    placeholder="e.g. cool flame, concurrent..."
                    className="w-full rounded border border-slate-700 bg-[#050B18] pl-8 pr-2.5 py-2 text-[#F8FAFC] placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {facets.hasOxygen && (
              <div>
                <div className="flex justify-between font-mono text-[#94A3B8] mb-1">
                  <span>Min Oxygen Concentration</span>
                  <span className="text-[#F8FAFC] font-mono-tabular">≥ {minO2}%</span>
                </div>
                <input
                  type="range"
                  min={14}
                  max={28}
                  step={0.5}
                  value={minO2}
                  onChange={(e) => setMinO2(Number(e.target.value))}
                  className="w-full accent-[#00D9FF]"
                />
              </div>
            )}

            {facets.hasPressure && (
              <div>
                <div className="flex justify-between font-mono text-[#94A3B8] mb-1">
                  <span>Max Ambient Pressure</span>
                  <span className="text-[#F8FAFC] font-mono-tabular">≤ {maxPressure} kPa</span>
                </div>
                <input
                  type="range"
                  min={55}
                  max={130}
                  step={1}
                  value={maxPressure}
                  onChange={(e) => setMaxPressure(Number(e.target.value))}
                  className="w-full accent-[#2563EB]"
                />
              </div>
            )}

            {facets.hasAirflow && (
              <div>
                <div className="flex justify-between font-mono text-[#94A3B8] mb-1">
                  <span>Min Forced Airflow</span>
                  <span className="text-[#F8FAFC] font-mono-tabular">≥ {minAirflow} cm/s</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={1}
                  value={minAirflow}
                  onChange={(e) => setMinAirflow(Number(e.target.value))}
                  className="w-full accent-[#00D9FF]"
                />
              </div>
            )}

            {facets.hasFuelTemp && (
              <div>
                <div className="flex justify-between font-mono text-[#94A3B8] mb-1">
                  <span>Min Fuel Temperature</span>
                  <span className="text-[#F8FAFC] font-mono-tabular">≥ {minFuelTemp} K</span>
                </div>
                <input
                  type="range"
                  min={280}
                  max={480}
                  step={5}
                  value={minFuelTemp}
                  onChange={(e) => setMinFuelTemp(Number(e.target.value))}
                  className="w-full accent-[#F59E0B]"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {loading && (
        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-10 text-center text-sm text-[#94A3B8]">
          Loading experimental combustion records from SQLite store...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-10 text-center text-sm text-[#94A3B8]">
          No combustion records match the active filter boundaries. Reset filters or broaden parameter bounds.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <>
          {/* 6 Interactive Scientific Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Flame Spread Rate vs Airflow Velocity */}
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
              <div className="mb-3">
                <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  1. Flame Spread Rate vs Forced Airflow Velocity
                </h3>
                <p className="font-mono text-[11px] text-[#94A3B8]">
                  Dataset: {selectedDataset} · X: Airflow (cm/s) · Y: Spread Rate (mm/s)
                </p>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 4 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="airflowCmS"
                      name="Airflow"
                      unit=" cm/s"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Airflow Velocity (cm/s)', position: 'bottom', offset: 2, fill: '#94A3B8', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="flameSpreadMmS"
                      name="Spread Rate"
                      unit=" mm/s"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Spread (mm/s)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
                    />
                    <ZAxis range={[50, 90]} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Scatter name="Microgravity (~0g)" data={microRecords} fill="#00D9FF" />
                    <Scatter name="Earth Gravity (1g)" data={earthRecords} fill="#F59E0B" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Ignition Delay vs Fuel Temperature */}
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
              <div className="mb-3">
                <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  2. Ignition Delay vs Fuel Surface Temperature
                </h3>
                <p className="font-mono text-[11px] text-[#94A3B8]">
                  Dataset: {selectedDataset} · X: Fuel Temp (K) · Y: Ignition Delay (s)
                </p>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 4 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="fuelTempK"
                      name="Fuel Temp"
                      unit=" K"
                      domain={['dataMin - 10', 'dataMax + 10']}
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Fuel Temperature (K)', position: 'bottom', offset: 2, fill: '#94A3B8', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="ignitionDelayS"
                      name="Ignition Delay"
                      unit=" s"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Delay (s)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Scatter name="Microgravity (~0g)" data={microRecords} fill="#8B5CF6" />
                    <Scatter name="Earth Gravity (1g)" data={earthRecords} fill="#22C55E" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Oxygen Concentration vs Combustion Spread Rate */}
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
              <div className="mb-3">
                <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  3. Oxygen Concentration vs Flame Spread Rate
                </h3>
                <p className="font-mono text-[11px] text-[#94A3B8]">
                  Dataset: {selectedDataset} · X: Oxygen (% vol) · Y: Spread Rate (mm/s)
                </p>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 4 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="oxygenPct"
                      name="O2"
                      unit="%"
                      domain={[14, 32]}
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Oxygen Concentration (% vol)', position: 'bottom', offset: 2, fill: '#94A3B8', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="flameSpreadMmS"
                      name="Spread"
                      unit=" mm/s"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Spread (mm/s)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Scatter name="Microgravity (~0g)" data={microRecords} fill="#2563EB" />
                    <Scatter name="Earth Gravity (1g)" data={earthRecords} fill="#F59E0B" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 4. Pressure vs Flame Propagation */}
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
              <div className="mb-3">
                <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  4. Ambient Pressure vs Flame Propagation
                </h3>
                <p className="font-mono text-[11px] text-[#94A3B8]">
                  Dataset: {selectedDataset} · X: Pressure (kPa) · Y: Spread Rate (mm/s)
                </p>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 4 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="pressureKpa"
                      name="Pressure"
                      unit=" kPa"
                      domain={[50, 125]}
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Ambient Pressure (kPa)', position: 'bottom', offset: 2, fill: '#94A3B8', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="flameSpreadMmS"
                      name="Spread"
                      unit=" mm/s"
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Spread (mm/s)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Scatter name="Microgravity (~0g)" data={microRecords} fill="#00D9FF" />
                    <Scatter name="Earth Gravity (1g)" data={earthRecords} fill="#EF4444" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 5. Flame Extinction Characteristics (LOC % vol) */}
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
              <div className="mb-3">
                <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  5. Limiting Oxygen Extinction Thresholds
                </h3>
                <p className="font-mono text-[11px] text-[#94A3B8]">
                  Dataset: {selectedDataset} · X: Run ID · Y: Extinction O2 (% vol)
                </p>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filtered.filter((r) => r.extinctionO2Pct !== null).slice(0, 14)}
                    margin={{ top: 10, right: 16, bottom: 20, left: 4 }}
                  >
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis dataKey="id" stroke="#94A3B8" tick={{ fontSize: 10 }} />
                    <YAxis
                      domain={[10, 25]}
                      stroke="#94A3B8"
                      tick={{ fontSize: 11 }}
                      label={{ value: 'Extinction O2 (%)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Bar dataKey="extinctionO2Pct" name="Extinction O2 Limit (% vol)" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 6. Heat Release & Peak Flame Temperature Trends */}
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
              <div className="mb-3">
                <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  6. Heat Release Rate &amp; Peak Flame Temperature Trends
                </h3>
                <p className="font-mono text-[11px] text-[#94A3B8]">
                  Dataset: {selectedDataset} · Left Y: Heat Release (kW/m²) · Right Y: Peak Temp (K)
                </p>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={filtered.filter((r) => r.heatReleaseKwM2 !== null).slice(0, 16)}
                    margin={{ top: 10, right: 16, bottom: 20, left: 4 }}
                  >
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis dataKey="id" stroke="#94A3B8" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#F59E0B" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#00D9FF" domain={[700, 2400]} tick={{ fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Line yAxisId="left" type="monotone" dataKey="heatReleaseKwM2" name="Heat Release (kW/m²)" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="peakFlameTempK" name="Peak Temp (K)" stroke="#00D9FF" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Earth Gravity (1g) vs Microgravity (~0g) Controlled Comparison Tool */}
          <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                  Earth Gravity (1g) vs Microgravity (~0g) Comparison
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Filter by matched fuel type to isolate buoyancy-driven convection effects from fuel geometry differences
                </p>
              </div>

              <select
                aria-label="Filter comparison by compatible fuel"
                value={compareFuel}
                onChange={(e) => setCompareFuel(e.target.value)}
                className="rounded border border-slate-700 bg-[#050B18] px-3 py-1.5 text-xs text-[#F8FAFC]"
              >
                <option value="ALL">All Filtered Fuels (Aggregate)</option>
                {comparableFuels.map((f) => (
                  <option key={f} value={f}>Matched Fuel: {f}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="rounded border border-slate-800 bg-[#050B18] p-4">
                <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Mean Spread Rate</p>
                <div className="mt-2 flex items-baseline justify-between font-mono-tabular">
                  <span className="text-lg font-bold text-[#00D9FF]">
                    {comparisonStats.microSpread ?? '—'} <small className="text-xs font-normal">mm/s (0g)</small>
                  </span>
                  <span className="text-sm text-[#F59E0B]">
                    {comparisonStats.earthSpread ?? '—'} <small className="text-xs">mm/s (1g)</small>
                  </span>
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-[#050B18] p-4">
                <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Extinction O2 Limit</p>
                <div className="mt-2 flex items-baseline justify-between font-mono-tabular">
                  <span className="text-lg font-bold text-[#00D9FF]">
                    {comparisonStats.microExtO2 ?? '—'}% <small className="text-xs font-normal">(0g)</small>
                  </span>
                  <span className="text-sm text-[#F59E0B]">
                    {comparisonStats.earthExtO2 ?? '—'}% <small className="text-xs">(1g)</small>
                  </span>
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-[#050B18] p-4">
                <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Mean Ignition Delay</p>
                <div className="mt-2 flex items-baseline justify-between font-mono-tabular">
                  <span className="text-lg font-bold text-[#00D9FF]">
                    {comparisonStats.microDelay ?? '—'} s <small className="text-xs font-normal">(0g)</small>
                  </span>
                  <span className="text-sm text-[#F59E0B]">
                    {comparisonStats.earthDelay ?? '—'} s <small className="text-xs">(1g)</small>
                  </span>
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-[#050B18] p-4">
                <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Mean Heat Release</p>
                <div className="mt-2 flex items-baseline justify-between font-mono-tabular">
                  <span className="text-lg font-bold text-[#00D9FF]">
                    {comparisonStats.microHeat ?? '—'} <small className="text-xs font-normal">kW/m² (0g)</small>
                  </span>
                  <span className="text-sm text-[#F59E0B]">
                    {comparisonStats.earthHeat ?? '—'} <small className="text-xs">kW/m² (1g)</small>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded border border-slate-800 bg-[#101D31]/70 p-3 text-xs text-[#CBD5E1]">
              <Info className="h-4 w-4 text-[#00D9FF] shrink-0 mt-0.5" />
              <span>
                <strong>Methodological Caveat:</strong> Microgravity runs (n={comparisonStats.microCount}) and Earth
                1g runs (n={comparisonStats.earthCount}) differ fundamentally in convective transport: 1g tests induce ~30 cm/s
                natural buoyant flow upward, whereas 0g tests depend on forced cabin airflow or pure molecular diffusion.
                Select a matched fuel above to avoid conflating droplet (FLEX) and solid polymer (SoFIE/Saffire) geometries.
              </span>
            </div>
          </section>

          {/* Scientific Records Table with Explicit Provenance */}
          <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
                Experimental Measurement Ledger
              </h2>
              <span className="font-mono text-xs text-[#94A3B8]">
                Units: O2 (% vol) · Pressure (kPa) · Airflow (cm/s) · Spread (mm/s) · Temp (K)
              </span>
            </div>

            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs border-collapse font-mono-tabular">
                <thead className="sticky top-0 bg-[#050B18] border-b border-slate-800 text-[#94A3B8]">
                  <tr>
                    <th className="py-2.5 px-2">ID / Dataset</th>
                    <th className="py-2.5 px-2">Experiment</th>
                    <th className="py-2.5 px-2">Gravity</th>
                    <th className="py-2.5 px-2">Fuel</th>
                    <th className="py-2.5 px-2 text-right">O2 %</th>
                    <th className="py-2.5 px-2 text-right">kPa</th>
                    <th className="py-2.5 px-2 text-right">Flow cm/s</th>
                    <th className="py-2.5 px-2 text-right">Spread mm/s</th>
                    <th className="py-2.5 px-2">Outcome</th>
                    <th className="py-2.5 px-2">Origin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-[#101D31]/60">
                      <td className="py-2 px-2 text-[#00D9FF]">{r.id}</td>
                      <td className="py-2 px-2 text-[#F8FAFC] font-sans font-medium">{r.experimentName}</td>
                      <td className="py-2 px-2 text-[#CBD5E1]">{r.gravityG < 0.01 ? '~0g' : `${r.gravityG}g`}</td>
                      <td className="py-2 px-2 text-[#CBD5E1] font-sans">{r.fuelType}</td>
                      <td className="py-2 px-2 text-right text-[#F8FAFC]">{r.oxygenPct.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right text-[#CBD5E1]">{r.pressureKpa.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right text-[#CBD5E1]">{r.airflowCmS.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right font-semibold text-[#00D9FF]">
                        {r.flameSpreadMmS !== null ? r.flameSpreadMmS.toFixed(2) : '—'}
                      </td>
                      <td className="py-2 px-2 text-[#CBD5E1] font-sans">{r.ignitionOutcome}</td>
                      <td className="py-2 px-2 text-[#94A3B8] font-sans">
                        {r.dataOrigin === 'NASA_CURATED_LITERATURE'
                          ? 'NASA Curated'
                          : r.dataOrigin === 'OFFLINE_DEMO_SAMPLE'
                          ? 'Offline Sample'
                          : 'Uploaded'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* CSV / JSON Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-[#0B1628] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
                Import Scientific Combustion Dataset (CSV / JSON)
              </h2>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                aria-label="Close import modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUploadFormat('csv')}
                  className={`px-3 py-1.5 text-xs font-mono rounded cursor-pointer ${
                    uploadFormat === 'csv' ? 'bg-[#2563EB] text-white' : 'bg-[#050B18] text-[#94A3B8]'
                  }`}
                >
                  CSV Format
                </button>
                <button
                  type="button"
                  onClick={() => setUploadFormat('json')}
                  className={`px-3 py-1.5 text-xs font-mono rounded cursor-pointer ${
                    uploadFormat === 'json' ? 'bg-[#2563EB] text-white' : 'bg-[#050B18] text-[#94A3B8]'
                  }`}
                >
                  JSON Format
                </button>
              </div>

              <button
                type="button"
                onClick={handleLoadSampleCsv}
                className="inline-flex items-center gap-1.5 text-xs text-[#00D9FF] hover:underline cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Load Offline Sample CSV Template</span>
              </button>
            </div>

            <textarea
              rows={8}
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              placeholder="Paste CSV rows (oxygen_pct, pressure_kpa, airflow_cm_s, fuel_temp_k, flame_spread_mm_s...) or JSON array..."
              className="w-full rounded border border-slate-700 bg-[#050B18] p-3 font-mono text-xs text-[#F8FAFC] focus:border-[#00D9FF] focus:outline-none"
            />

            {uploadStatus && (
              <p className="mt-2 font-mono text-xs text-[#00D9FF]">{uploadStatus}</p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="rounded border border-slate-700 px-4 py-2 text-xs text-[#CBD5E1] hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={!uploadText.trim()}
                className="rounded bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
              >
                Validate &amp; Ingest Dataset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
