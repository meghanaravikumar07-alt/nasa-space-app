import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import type { InvestigationProfile, OsdrStudyMetadata } from '../../types/combustion.ts';

export function MissionResearchView({
  onSyncNasa,
  syncing,
}: {
  onSyncNasa: () => Promise<void>;
  syncing: boolean;
}) {
  const [investigations, setInvestigations] = useState<InvestigationProfile[]>([]);
  const [osdrStudies, setOsdrStudies] = useState<OsdrStudyMetadata[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadResearch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/research/investigations');
      if (res.ok) {
        const json = (await res.json()) as {
          investigations: InvestigationProfile[];
          osdrStudies: OsdrStudyMetadata[];
        };
        setInvestigations(json.investigations);
        setOsdrStudies(json.osdrStudies);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResearch();
  }, []);

  const filteredInvestigations = useMemo(() => {
    if (!query.trim()) return investigations;
    const q = query.toLowerCase();
    return investigations.filter((inv) =>
      `${inv.name} ${inv.objective} ${inv.methodology} ${inv.fuelMaterials.join(' ')} ${inv.scientificFindings.join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [investigations, query]);

  const filteredOsdr = useMemo(() => {
    if (!query.trim()) return osdrStudies;
    const q = query.toLowerCase();
    return osdrStudies.filter((s) =>
      `${s.accession} ${s.title} ${s.description} ${s.organismOrMaterial}`.toLowerCase().includes(q)
    );
  }, [osdrStudies, query]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#00D9FF] mb-1">
            Official NASA Flight Investigations &amp; OSDR Index
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F8FAFC]">
            Mission Research Library
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FLEX, SoFIE, PMMA, cool flame..."
              className="w-64 rounded-md border border-slate-700 bg-[#0B1628] pl-8 pr-3 py-2 text-xs text-[#F8FAFC] placeholder:text-slate-500 focus:border-[#00D9FF] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={async () => {
              await onSyncNasa();
              await loadResearch();
            }}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-[#101D31] px-4 py-2 text-xs font-semibold text-[#F8FAFC] hover:border-[#00D9FF]/60 hover:text-[#00D9FF] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>Refresh OSDR Index</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-10 text-center text-sm text-[#94A3B8]">
          Loading mission research profiles...
        </div>
      )}

      {/* Primary NASA Flight Investigation Cards */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
          Core Microgravity Combustion Investigations ({filteredInvestigations.length})
        </h2>

        {filteredInvestigations.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-8 text-center text-xs text-[#94A3B8]">
            No flight investigations matched &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredInvestigations.map((inv) => (
              <article key={inv.id} className="rounded-lg border border-slate-800 bg-[#0B1628] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#F8FAFC]">{inv.name}</h3>
                    <p className="mt-1 font-mono text-xs text-[#94A3B8]">
                      {inv.facility} · {inv.gravityEnvironment} · Dataset ID: {inv.datasetIdentifier}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <a
                      href={inv.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
                    >
                      <span>Open Official Source</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {inv.secondaryUrl && (
                      <a
                        href={inv.secondaryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-3.5 py-2 text-xs font-medium text-[#CBD5E1] hover:text-[#00D9FF]"
                      >
                        <span>NASA Glenn Portal</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs leading-relaxed">
                  <div className="lg:col-span-6 space-y-3">
                    <div>
                      <p className="font-mono uppercase tracking-wider text-[#00D9FF] mb-1">Research Objective</p>
                      <p className="text-[#E2E8F0]">{inv.objective}</p>
                    </div>
                    <div>
                      <p className="font-mono uppercase tracking-wider text-[#94A3B8] mb-1">Experimental Methodology</p>
                      <p className="text-[#CBD5E1]">{inv.methodology}</p>
                    </div>
                    <div>
                      <p className="font-mono uppercase tracking-wider text-[#94A3B8] mb-1">Spacecraft Fire Safety Relevance</p>
                      <p className="text-[#CBD5E1]">{inv.safetyRelevance}</p>
                    </div>
                  </div>

                  <div className="lg:col-span-6 space-y-3">
                    <div>
                      <p className="font-mono uppercase tracking-wider text-[#94A3B8] mb-1">Key Parameters &amp; Fuels</p>
                      <p className="text-[#F8FAFC] mb-1">Fuels: {inv.fuelMaterials.join(', ')}</p>
                      <p className="text-[#CBD5E1]">{inv.keyParameters.join(' · ')}</p>
                    </div>
                    <div>
                      <p className="font-mono uppercase tracking-wider text-[#F59E0B] mb-1">Key Scientific Findings</p>
                      <ul className="space-y-1 text-[#CBD5E1] list-disc pl-4">
                        {inv.scientificFindings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="font-mono text-[11px] text-[#22C55E] pt-1">
                      Availability: {inv.dataAvailability}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Live Retrieved NASA OSDR Studies */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
            NASA Open Science Data Repository (OSDR) Indexed Studies ({filteredOsdr.length})
          </h2>
          <a
            href="https://osdr.nasa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#00D9FF] hover:underline"
          >
            <span>Browse OSDR Portal</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOsdr.map((study) => (
            <div key={study.accession} className="rounded-lg border border-slate-800 bg-[#0B1628] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] mb-1.5">
                  <span className="text-[#00D9FF]">{study.accession}</span>
                  <span className={study.dataOrigin === 'NASA_OSDR_LIVE' ? 'text-[#22C55E]' : 'text-[#F59E0B]'}>
                    {study.dataOrigin === 'NASA_OSDR_LIVE' ? 'Live OSDR API' : 'Offline Sample Reference'}
                  </span>
                </div>
                <h3 className="font-display text-sm font-semibold text-[#F8FAFC] mb-2">
                  {study.title}
                </h3>
                <p className="text-xs leading-relaxed text-[#94A3B8] mb-3">
                  {study.description}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                <span className="font-mono text-[#94A3B8] truncate max-w-[65%]">
                  {study.studyType} · {study.releaseDate}
                </span>
                <a
                  href={study.studyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#00D9FF] hover:underline shrink-0"
                >
                  <span>View Study</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
