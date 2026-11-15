import { AlertTriangle, Flame, Layers, ShieldCheck } from 'lucide-react';

export function AboutProjectView() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="border-b border-slate-800 pb-5">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#00D9FF] mb-1">
          Scientific Mission Brief
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F8FAFC]">
          About ORBITAL X
        </h1>
        <p className="mt-2 text-sm text-[#CBD5E1]">
          Understanding Fire Beyond Gravity. Protecting Life Beyond Earth.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#F59E0B]">
            <Flame className="h-5 w-5" />
            <h2 className="font-display text-base font-semibold text-[#F8FAFC]">The Problem</h2>
          </div>
          <p className="text-xs leading-relaxed text-[#CBD5E1]">
            Fire behaves fundamentally differently in microgravity because buoyancy-driven natural convection is nearly
            eliminated. Without hot gases rising and drawing fresh air upward, flames become spherical, soot shells trap
            radiative heat, invisible low-temperature cool flames can persist after visible extinguishment, and low-speed
            spacecraft HVAC ventilation can accelerate solid-polymer flame spread beyond Earth 1g behavior.
          </p>
        </section>

        <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#00D9FF]">
            <Layers className="h-5 w-5" />
            <h2 className="font-display text-base font-semibold text-[#F8FAFC]">The Solution</h2>
          </div>
          <p className="text-xs leading-relaxed text-[#CBD5E1]">
            ORBITAL X unifies historical NASA microgravity combustion investigations (FLEX, FLEX-2, SoFIE, SoFIE-GEL,
            and Saffire) with live NASA Open Science Data Repository (OSDR) connectivity, a persistent SQLite data
            pipeline, explainable Ridge Regression &amp; correlation modeling, an interactive 3D combustion chamber
            approximator, and exportable engineering briefs.
          </p>
        </section>

        <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#22C55E]">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="font-display text-base font-semibold text-[#F8FAFC]">The Impact</h2>
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-[#CBD5E1] list-disc pl-4">
            <li>Supports research into crewed exploration cabin atmospheres (e.g., 57 kPa / 26.5% O2).</li>
            <li>Clarifies material flammability differences between 1g screening and ~0g flight behavior.</li>
            <li>Highlights low-velocity ventilation fire hazards and cool-flame detection gaps.</li>
            <li>Connects microgravity soot/cool-flame discoveries to cleaner Earth combustion engineering.</li>
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-slate-800 bg-[#0B1628] p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-[#F59E0B]">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="font-display text-lg font-semibold text-[#F8FAFC]">
            Prototype Scope, Limitations &amp; Data Integrity
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed text-[#CBD5E1]">
          <div className="space-y-2">
            <h3 className="font-mono uppercase tracking-wider text-[#00D9FF]">
              Scientific &amp; Modeling Boundaries
            </h3>
            <p>
              ORBITAL X is an experimental research and hackathon intelligence prototype. Its Ridge Regression spread-rate
              estimator and composite risk index are trained on curated literature records and user-uploaded datasets—not
              validated computational fluid dynamics (CFD) or detailed chemical kinetic solvers.
            </p>
            <p>
              All risk tiers (LOW, MODERATE, ELEVATED, HIGH) are research-support indicators and must never be treated
              as certified NASA flight safety rules or replacements for NASA-STD-6001 material qualification testing.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-mono uppercase tracking-wider text-[#00D9FF]">
              Provenance &amp; Real-Time Connectivity Policy
            </h3>
            <p>
              Historical orbital combustion experiments do not stream live flame sensors. ORBITAL X distinguishes
              clearly between live repository availability checks (NASA OSDR API, NASA PSI, NASA Science portals),
              curated literature records, user-uploaded CSV/JSON datasets, and offline sample files.
            </p>
            <p>
              This independent research tool uses publicly documented NASA scientific portals and is not officially
              endorsed by or affiliated with NASA.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
