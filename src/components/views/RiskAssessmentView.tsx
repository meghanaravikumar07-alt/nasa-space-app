import { useEffect, useState } from 'react';
import { AlertTriangle, FileDown, ShieldAlert } from 'lucide-react';
import type { MlAnalysisResponse, RiskPredictionResult } from '../../types/combustion.ts';
import { exportCombustionPdfReport } from '../../utils/pdfReport.ts';

const PRESET_SCENARIOS = [
  {
    name: 'ISS Normoxic Cabin (101.3 kPa, 21% O2)',
    oxygenPct: 21.0,
    pressureKpa: 101.3,
    airflowCmS: 10.0,
    fuelTempK: 340,
    gravityG: 0.00001,
    fuelType: 'Cast PMMA',
  },
  {
    name: 'Exploration Atmosphere (57 kPa, 26.5% O2)',
    oxygenPct: 26.5,
    pressureKpa: 57.0,
    airflowCmS: 15.0,
    fuelTempK: 365,
    gravityG: 0.00001,
    fuelType: 'Cotton-Fiberglass (SIBAL)',
  },
  {
    name: 'Quiescent Droplet Leak (101.3 kPa, 18% O2)',
    oxygenPct: 18.0,
    pressureKpa: 101.3,
    airflowCmS: 0.5,
    fuelTempK: 298,
    gravityG: 0.00001,
    fuelType: 'n-Heptane Droplet',
  },
  {
    name: 'Earth 1g Baseline (101.3 kPa, 21% O2)',
    oxygenPct: 21.0,
    pressureKpa: 101.3,
    airflowCmS: 10.0,
    fuelTempK: 340,
    gravityG: 1.0,
    fuelType: 'Cast PMMA',
  },
];

export function RiskAssessmentView({
  analysis,
  totalRecords,
}: {
  analysis: MlAnalysisResponse | null;
  totalRecords: number;
}) {
  const [oxygenPct, setOxygenPct] = useState(26.5);
  const [pressureKpa, setPressureKpa] = useState(57.0);
  const [airflowCmS, setAirflowCmS] = useState(15.0);
  const [fuelTempK, setFuelTempK] = useState(365);
  const [gravityG, setGravityG] = useState(0.00001);
  const [fuelType, setFuelType] = useState('Cast PMMA');
  const [result, setResult] = useState<RiskPredictionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runPrediction = async (payload = { oxygenPct, pressureKpa, airflowCmS, fuelTempK, gravityG, fuelType }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setResult((await res.json()) as RiskPredictionResult);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runPrediction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (p: (typeof PRESET_SCENARIOS)[number]) => {
    setOxygenPct(p.oxygenPct);
    setPressureKpa(p.pressureKpa);
    setAirflowCmS(p.airflowCmS);
    setFuelTempK(p.fuelTempK);
    setGravityG(p.gravityG);
    setFuelType(p.fuelType);
    runPrediction({
      oxygenPct: p.oxygenPct,
      pressureKpa: p.pressureKpa,
      airflowCmS: p.airflowCmS,
      fuelTempK: p.fuelTempK,
      gravityG: p.gravityG,
      fuelType: p.fuelType,
    });
  };

  const riskAccent =
    result?.riskLevel === 'HIGH RISK'
      ? 'text-[#EF4444] border-[#EF4444]/50 bg-[#EF4444]/10'
      : result?.riskLevel === 'ELEVATED RISK'
      ? 'text-[#F59E0B] border-[#F59E0B]/50 bg-[#F59E0B]/10'
      : result?.riskLevel === 'MODERATE RISK'
      ? 'text-[#00D9FF] border-[#00D9FF]/50 bg-[#00D9FF]/10'
      : 'text-[#22C55E] border-[#22C55E]/50 bg-[#22C55E]/10';

  // Risk Matrix Grid: Oxygen (rows: 30, 26, 22, 18%) vs Airflow (cols: 0, 8, 16, 24 cm/s)
  const o2Rows = [30, 26, 22, 18];
  const flowCols = [0, 8, 16, 24];
  const cellRisk = (o2: number, flow: number) => {
    const score = (o2 - 15) * 2.5 + (flow >= 6 && flow <= 24 ? 22 : 8) + (pressureKpa < 75 && o2 >= 24 ? 14 : 5);
    if (score >= 68) return { label: 'HIGH', cls: 'bg-[#EF4444]/25 border-[#EF4444]/40 text-[#FCA5A5]' };
    if (score >= 48) return { label: 'ELEVATED', cls: 'bg-[#F59E0B]/25 border-[#F59E0B]/40 text-[#FDE68A]' };
    if (score >= 28) return { label: 'MODERATE', cls: 'bg-[#2563EB]/25 border-[#2563EB]/40 text-[#BFDBFE]' };
    return { label: 'LOW', cls: 'bg-[#22C55E]/20 border-[#22C55E]/40 text-[#BBF7D0]' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#00D9FF] mb-1">
            Experimental Research Risk Support
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F8FAFC]">
            Spacecraft Fire Safety Assessment
          </h1>
        </div>

        <button
          type="button"
          onClick={() =>
            exportCombustionPdfReport({
              prediction: result,
              analysis,
              selectedExperiment: `${fuelType} (${oxygenPct}% O2, ${pressureKpa} kPa)`,
              datasetCount: totalRecords,
            })
          }
          className="inline-flex items-center gap-2 rounded-md bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileDown className="h-4 w-4" />
          <span>Export Analysis (PDF)</span>
        </button>
      </div>

      {/* Mandatory Prototype Disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 text-xs text-[#FDE68A]">
        <AlertTriangle className="h-4 w-4 text-[#F59E0B] shrink-0 mt-0.5" />
        <p>
          <strong>Research Prototype Notice:</strong> This assessment module is an experimental statistical prototype
          calibrated on historical NASA combustion datasets. It cannot replace official spacecraft fire-safety procedures
          or certified engineering evaluations (NASA-STD-6001).
        </p>
      </div>

      {/* Mission Atmosphere Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESET_SCENARIOS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyPreset(p)}
            className="rounded border border-slate-700 bg-[#0B1628] px-3 py-1.5 text-xs text-[#CBD5E1] hover:border-[#00D9FF]/60 hover:text-[#00D9FF] transition-colors cursor-pointer"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Parameter Input Panel */}
        <section className="lg:col-span-4 rounded-lg border border-slate-800 bg-[#0B1628] p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#F8FAFC]">
            Input Environmental Conditions
          </h2>

          <div>
            <label className="block font-mono text-xs text-[#94A3B8] mb-1">Material / Fuel</label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              className="w-full rounded border border-slate-700 bg-[#050B18] px-3 py-2 text-xs text-[#F8FAFC]"
            >
              <option value="Cast PMMA">Cast PMMA</option>
              <option value="Cotton-Fiberglass (SIBAL)">Cotton-Fiberglass (SIBAL)</option>
              <option value="n-Heptane Droplet">n-Heptane Droplet</option>
              <option value="Nomex / Flame-Retardant Textile">Nomex / Flame-Retardant Textile</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-[#94A3B8] mb-1">Gravity Environment</label>
            <select
              value={gravityG < 0.05 ? '0' : '1'}
              onChange={(e) => setGravityG(e.target.value === '0' ? 0.00001 : 1.0)}
              className="w-full rounded border border-slate-700 bg-[#050B18] px-3 py-2 text-xs text-[#F8FAFC]"
            >
              <option value="0">Microgravity (~0g)</option>
              <option value="1">Earth Gravity (1g)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-mono text-[#94A3B8] mb-1">Oxygen (% vol)</label>
              <input
                type="number"
                min={12}
                max={40}
                step={0.5}
                value={oxygenPct}
                onChange={(e) => setOxygenPct(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-[#050B18] px-2.5 py-2 font-mono-tabular text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block font-mono text-[#94A3B8] mb-1">Pressure (kPa)</label>
              <input
                type="number"
                min={40}
                max={150}
                step={1}
                value={pressureKpa}
                onChange={(e) => setPressureKpa(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-[#050B18] px-2.5 py-2 font-mono-tabular text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block font-mono text-[#94A3B8] mb-1">Airflow (cm/s)</label>
              <input
                type="number"
                min={0}
                max={40}
                step={0.5}
                value={airflowCmS}
                onChange={(e) => setAirflowCmS(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-[#050B18] px-2.5 py-2 font-mono-tabular text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block font-mono text-[#94A3B8] mb-1">Fuel Temp (K)</label>
              <input
                type="number"
                min={270}
                max={700}
                step={5}
                value={fuelTempK}
                onChange={(e) => setFuelTempK(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-[#050B18] px-2.5 py-2 font-mono-tabular text-[#F8FAFC]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => runPrediction()}
            disabled={loading}
            className="w-full rounded bg-[#2563EB] py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? 'Evaluating ML Risk Model...' : 'Run Risk Assessment'}
          </button>
        </section>

        {/* Assessment Results & Visual Risk Matrix */}
        <div className="lg:col-span-8 space-y-6">
          {result && (
            <>
              {/* Classification Header Card */}
              <div className={`rounded-lg border p-6 ${riskAccent}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-wider opacity-85">
                      Estimated Prototype Risk Category
                    </p>
                    <div className="mt-1 flex items-center gap-2.5">
                      <ShieldAlert className="h-6 w-6" />
                      <span className="font-display text-2xl font-bold">{result.riskLevel}</span>
                    </div>
                  </div>

                  <div className="text-right font-mono-tabular">
                    <p className="text-xs opacity-85">Predicted Flame Spread</p>
                    <p className="text-2xl font-bold text-[#F8FAFC]">
                      {result.predictedFlameSpreadMmS} <span className="text-xs font-normal">mm/s</span>
                    </p>
                    <p className="text-[11px] opacity-85">
                      95% Bound: {result.confidenceIntervalMmS[0]} – {result.confidenceIntervalMmS[1]} mm/s · Index {result.compositeRiskIndex}/100
                    </p>
                  </div>
                </div>
              </div>

              {/* Contributing Variables + Visual Risk Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
                  <h3 className="font-display text-sm font-semibold text-[#F8FAFC] mb-3">
                    Important Contributing Variables
                  </h3>
                  <div className="space-y-3 text-xs">
                    {result.contributingVariables.map((v) => (
                      <div key={v.variable} className="border-b border-slate-800 pb-2.5 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between font-mono mb-1">
                          <span className="text-[#F8FAFC] font-medium">{v.variable}</span>
                          <span
                            className={
                              v.impact === 'High'
                                ? 'text-[#EF4444]'
                                : v.impact === 'Moderate'
                                ? 'text-[#F59E0B]'
                                : 'text-[#22C55E]'
                            }
                          >
                            {v.valueFormatted} · {v.impact}
                          </span>
                        </div>
                        <p className="text-[#94A3B8] leading-relaxed">{v.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2D Visual Risk Matrix */}
                <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
                  <h3 className="font-display text-sm font-semibold text-[#F8FAFC] mb-1">
                    Environmental Risk Matrix (O2 % vs Airflow)
                  </h3>
                  <p className="font-mono text-[11px] text-[#94A3B8] mb-3">
                    At {pressureKpa} kPa cabin pressure (prototype classification surface)
                  </p>
                  <div className="grid grid-cols-5 gap-1.5 text-[11px] font-mono text-center">
                    <div />
                    {flowCols.map((f) => (
                      <div key={f} className="text-[#94A3B8] py-1">{f} cm/s</div>
                    ))}
                    {o2Rows.map((o2) => (
                      <div key={`row-${o2}`} className="contents">
                        <div className="flex items-center justify-end pr-2 text-[#94A3B8]">{o2}% O2</div>
                        {flowCols.map((f) => {
                          const cell = cellRisk(o2, f);
                          const isCurrent =
                            Math.abs(oxygenPct - o2) <= 2.2 && Math.abs(airflowCmS - f) <= 4.5;
                          return (
                            <div
                              key={`${o2}-${f}`}
                              className={`rounded border py-2.5 font-semibold ${cell.cls} ${
                                isCurrent ? 'ring-2 ring-[#F8FAFC]' : ''
                              }`}
                            >
                              {cell.label}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-[#94A3B8]">
                    White outline marks the cell closest to your current input parameters.
                  </p>
                </div>
              </div>

              {/* Matched Historical Runs + Recommended Investigations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
                  <h3 className="font-display text-sm font-semibold text-[#F8FAFC] mb-3">
                    Closest Historical Experimental Patterns
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    {result.matchedHistoricalRecords.map((rec) => (
                      <div key={rec.id} className="rounded border border-slate-800 bg-[#050B18] p-3">
                        <div className="flex justify-between font-mono text-[#00D9FF] mb-1">
                          <span>{rec.experimentName} · {rec.id}</span>
                          <span>{rec.flameSpreadMmS ?? '—'} mm/s</span>
                        </div>
                        <p className="text-[#F8FAFC]">{rec.fuelType} · {rec.gravityCondition}</p>
                        <p className="text-[#94A3B8] font-mono-tabular mt-0.5">
                          O2: {rec.oxygenPct}% · {rec.pressureKpa} kPa · Flow: {rec.airflowCmS} cm/s · {rec.ignitionOutcome}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5 space-y-4 text-xs">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[#F8FAFC] mb-2">
                      Recommended Areas for Further Investigation
                    </h3>
                    <ul className="space-y-1.5 text-[#CBD5E1] list-disc pl-4">
                      {result.recommendedInvestigations.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-slate-800 pt-3">
                    <h4 className="font-mono text-[11px] uppercase text-[#94A3B8] mb-1.5">
                      Model Limitations
                    </h4>
                    <ul className="space-y-1 text-[#94A3B8] list-disc pl-4">
                      {result.modelLimitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
