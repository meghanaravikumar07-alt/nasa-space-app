import { useEffect, useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MlAnalysisResponse } from '../../types/combustion.ts';

export function AiIntelligenceView() {
  const [analysis, setAnalysis] = useState<MlAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState(
    'Which environmental parameters most strongly accelerate flame spread in microgravity, and where do cool-flame anomalies occur?'
  );
  const [focusExp, setFocusExp] = useState('ALL');
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; modelUsed: string } | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetch('/api/ml/analysis')
      .then((r) => r.json())
      .then((d: MlAnalysisResponse) => {
        setAnalysis(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAskAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      const res = await fetch('/api/ai/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, focusExperiment: focusExp }),
      });
      const json = (await res.json()) as { answer: string; modelUsed: string };
      setAiAnswer(json);
    } finally {
      setAsking(false);
    }
  };

  if (loading || !analysis) {
    return (
      <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-12 text-center text-sm text-[#94A3B8]">
        Training Ridge Regression &amp; computing empirical combustion correlations...
      </div>
    );
  }

  const trainPoints = analysis.actualVsPredicted.filter((p) => p.split === 'train');
  const testPoints = analysis.actualVsPredicted.filter((p) => p.split === 'test');

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-800 pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#00D9FF] mb-1">
          Explainable Machine Learning Pipeline
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F8FAFC]">
          AI Combustion Intelligence
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[#CBD5E1]">
          {analysis.modelType} evaluated on {analysis.sampleCount} experimental runs ({analysis.trainCount} train /{' '}
          {analysis.testCount} holdout test split).
        </p>
      </div>

      {/* Prototype Research Disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 text-xs text-[#FDE68A]">
        <AlertTriangle className="h-4 w-4 text-[#F59E0B] shrink-0 mt-0.5" />
        <p>{analysis.disclaimer}</p>
      </div>

      {/* Model Evaluation Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4">
          <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Holdout Test R²</p>
          <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#00D9FF]">
            {analysis.metrics.testR2}
          </p>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Unseen 20% test split</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4">
          <p className="font-mono text-[11px] uppercase text-[#94A3B8]">5-Fold CV R²</p>
          <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#F8FAFC]">
            {analysis.metrics.cvR2}
          </p>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Cross-validated score</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4">
          <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Test RMSE</p>
          <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#F8FAFC]">
            {analysis.metrics.rmseMmS} <span className="text-xs font-normal text-[#94A3B8]">mm/s</span>
          </p>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Root mean squared error</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4">
          <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Test MAE</p>
          <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#F8FAFC]">
            {analysis.metrics.maeMmS} <span className="text-xs font-normal text-[#94A3B8]">mm/s</span>
          </p>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Mean absolute error</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4 col-span-2 lg:col-span-1">
          <p className="font-mono text-[11px] uppercase text-[#94A3B8]">95% Error Band</p>
          <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#8B5CF6]">
            ±{(analysis.metrics.residualStdMmS * 1.96).toFixed(2)} <span className="text-xs font-normal text-[#94A3B8]">mm/s</span>
          </p>
          <p className="mt-1 text-[11px] text-[#94A3B8]">Empirical residual spread</p>
        </div>
      </section>

      {/* Feature Importance + Actual vs Predicted */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <h2 className="font-display text-base font-semibold text-[#F8FAFC] mb-1">
            Standardized Feature Importance
          </h2>
          <p className="font-mono text-xs text-[#94A3B8] mb-4">
            Relative standardized regression weights predicting Flame Spread Rate (mm/s)
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analysis.featureImportance}
                layout="vertical"
                margin={{ top: 5, right: 24, bottom: 5, left: 20 }}
              >
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis type="number" unit="%" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={145} stroke="#94A3B8" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#050B18', borderColor: '#334155', fontSize: 12 }}
                  formatter={(v: unknown) => [`${v}%`, 'Normalized Importance']}
                />
                <Bar dataKey="importancePct" fill="#00D9FF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <h2 className="font-display text-base font-semibold text-[#F8FAFC] mb-1">
            Predicted vs Actual Flame Spread Rate
          </h2>
          <p className="font-mono text-xs text-[#94A3B8] mb-4">
            Train (n={analysis.trainCount}) and Holdout Test (n={analysis.testCount}) parity plot
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 4 }}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="actualMmS"
                  name="Actual"
                  unit=" mm/s"
                  stroke="#94A3B8"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Actual Spread Rate (mm/s)', position: 'bottom', offset: 2, fill: '#94A3B8', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="predictedMmS"
                  name="Predicted"
                  unit=" mm/s"
                  stroke="#94A3B8"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Predicted (mm/s)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11 }}
                />
                <Tooltip contentStyle={{ backgroundColor: '#050B18', borderColor: '#334155', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Scatter name="Training Split" data={trainPoints} fill="#2563EB" />
                <Scatter name="Holdout Test Split" data={testPoints} fill="#22C55E" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Empirical Pearson Correlations + Risk Classification Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <h2 className="font-display text-base font-semibold text-[#F8FAFC] mb-3">
            Empirical Pearson Correlation Analysis
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono-tabular">
              <thead>
                <tr className="border-b border-slate-800 text-[#94A3B8]">
                  <th className="py-2 pr-4">Environmental Parameter</th>
                  <th className="py-2 pr-4">Target Variable</th>
                  <th className="py-2 pr-4 text-right">Pearson r</th>
                  <th className="py-2 pr-4 text-right">Sample (n)</th>
                  <th className="py-2">Relationship Strength</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {analysis.correlations.map((c, idx) => {
                  const absR = Math.abs(c.r);
                  return (
                    <tr key={idx}>
                      <td className="py-2.5 pr-4 font-sans text-[#F8FAFC]">{c.labelA}</td>
                      <td className="py-2.5 pr-4 font-sans text-[#CBD5E1]">{c.labelB}</td>
                      <td
                        className={`py-2.5 pr-4 text-right font-semibold ${
                          c.r > 0.25 ? 'text-[#00D9FF]' : c.r < -0.25 ? 'text-[#F59E0B]' : 'text-[#94A3B8]'
                        }`}
                      >
                        {c.r > 0 ? `+${c.r}` : c.r}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-[#94A3B8]">{c.n}</td>
                      <td className="py-2.5 font-sans text-[#CBD5E1]">
                        {absR >= 0.6 ? 'Strong' : absR >= 0.3 ? 'Moderate' : 'Weak / Non-linear'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-lg border border-slate-800 bg-[#0B1628] p-5">
          <h2 className="font-display text-base font-semibold text-[#F8FAFC] mb-1">
            Prototype Risk Classification
          </h2>
          <p className="text-xs text-[#94A3B8] mb-4">
            Distribution across {analysis.sampleCount} evaluated records (non-certified research index)
          </p>
          <div className="space-y-3 text-xs font-mono-tabular">
            {(['LOW RISK', 'MODERATE RISK', 'ELEVATED RISK', 'HIGH RISK'] as const).map((tier) => {
              const count = analysis.riskDistribution[tier] ?? 0;
              const pct = analysis.sampleCount ? Math.round((count / analysis.sampleCount) * 100) : 0;
              const barColor =
                tier === 'HIGH RISK'
                  ? 'bg-[#EF4444]'
                  : tier === 'ELEVATED RISK'
                  ? 'bg-[#F59E0B]'
                  : tier === 'MODERATE RISK'
                  ? 'bg-[#2563EB]'
                  : 'bg-[#22C55E]';
              return (
                <div key={tier}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[#F8FAFC]">{tier}</span>
                    <span className="text-[#94A3B8]">{count} runs ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded bg-[#050B18] overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Data-Grounded Insights */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
          AI-Generated Scientific Insights (Grounded in Active Dataset)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.insights.map((ins) => (
            <div key={ins.id} className="rounded-lg border border-slate-800 bg-[#0B1628] p-5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#00D9FF] mb-1.5">
                <span>{ins.category}</span>
                <span className="text-[#94A3B8]">{ins.datasetScope}</span>
              </div>
              <h3 className="font-display text-sm font-semibold text-[#F8FAFC] mb-2">
                {ins.title}
              </h3>
              <p className="text-xs leading-relaxed text-[#CBD5E1] mb-3">{ins.finding}</p>
              <p className="font-mono text-[11px] text-[#94A3B8] border-t border-slate-800 pt-2">
                Evidence: <span className="text-[#F8FAFC]">{ins.evidenceMetric}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Researcher Synthesis Query (Server-side Gemini 4 Hydrogen) */}
      <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-6">
        <h2 className="font-display text-base font-semibold text-[#F8FAFC] mb-1">
          Interactive Data Synthesis Query
        </h2>
        <p className="text-xs text-[#94A3B8] mb-4">
          Ask a scientific question about the loaded combustion records; synthesis is strictly grounded in computed dataset statistics.
        </p>

        <form onSubmit={handleAskAi} className="flex flex-col sm:flex-row gap-3">
          <select
            value={focusExp}
            onChange={(e) => setFocusExp(e.target.value)}
            className="rounded border border-slate-700 bg-[#050B18] px-3 py-2 text-xs text-[#F8FAFC]"
          >
            <option value="ALL">All Experiments</option>
            <option value="FLEX">FLEX</option>
            <option value="FLEX-2">FLEX-2</option>
            <option value="SoFIE">SoFIE</option>
            <option value="SoFIE-GEL">SoFIE-GEL</option>
            <option value="Saffire">Saffire</option>
          </select>

          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about flame spread drivers, extinction thresholds, or 1g vs 0g behavior..."
            className="flex-1 rounded border border-slate-700 bg-[#050B18] px-3.5 py-2 text-xs text-[#F8FAFC] focus:border-[#00D9FF] focus:outline-none"
          />

          <button
            type="submit"
            disabled={asking}
            className="inline-flex items-center justify-center gap-2 rounded bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{asking ? 'Analyzing...' : 'Synthesize Insights'}</span>
          </button>
        </form>

        {aiAnswer && (
          <div className="mt-4 rounded border border-slate-800 bg-[#050B18] p-4">
            <p className="font-mono text-[11px] text-[#00D9FF] mb-1.5">
              Engine: {aiAnswer.modelUsed}
            </p>
            <p className="text-sm leading-relaxed text-[#E2E8F0]">{aiAnswer.answer}</p>
          </div>
        )}

        <div className="mt-5 border-t border-slate-800 pt-4">
          <p className="font-mono text-[11px] uppercase text-[#94A3B8] mb-2">
            Documented Dataset &amp; Model Limitations
          </p>
          <ul className="space-y-1 text-xs text-[#94A3B8] list-disc pl-4">
            {analysis.limitations.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
