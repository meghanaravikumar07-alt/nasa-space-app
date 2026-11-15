import { useMemo, useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import { FlameSimulator3D } from '../three/FlameSimulator3D.tsx';

const FUEL_MODIFIERS: Record<string, { label: string; spreadFactor: number; tempOffset: number; locBase: number }> = {
  'Cast PMMA': { label: 'Cast PMMA (Solid Polymer)', spreadFactor: 1.0, tempOffset: 0, locBase: 16.5 },
  'Cotton-Fiberglass (SIBAL)': { label: 'Cotton-Fiberglass (SIBAL Textile)', spreadFactor: 1.85, tempOffset: -60, locBase: 15.4 },
  'n-Heptane Droplet': { label: 'n-Heptane Liquid Droplet', spreadFactor: 0.42, tempOffset: -90, locBase: 14.8 },
  'Nomex Composite': { label: 'Nomex Flame-Retardant Textile', spreadFactor: 0.34, tempOffset: -320, locBase: 22.1 },
};

export function SimulationLabView() {
  const [gravityG, setGravityG] = useState(0.0);
  const [oxygenPct, setOxygenPct] = useState(21.0);
  const [pressureKpa, setPressureKpa] = useState(101.3);
  const [airflowCmS, setAirflowCmS] = useState(10.0);
  const [fuelTempK, setFuelTempK] = useState(350);
  const [fuelType, setFuelType] = useState('Cast PMMA');

  // Documented physics-based analytical approximation (not CFD)
  const simOutputs = useMemo(() => {
    const fuel = FUEL_MODIFIERS[fuelType] ?? FUEL_MODIFIERS['Cast PMMA'];
    const isMicrogravity = gravityG < 0.05;

    // Effective convective velocity combining buoyancy-induced ~30*sqrt(g) cm/s and forced airflow
    const buoyantVelCmS = 30.0 * Math.sqrt(Math.max(0, gravityG));
    const effectiveVelCmS = Math.sqrt(buoyantVelCmS ** 2 + airflowCmS ** 2);

    // Non-monotonic airflow enhancement + radiative quenching (<2 cm/s) + blow-off (>28 cm/s near low O2)
    const flowFactor =
      airflowCmS < 2 && isMicrogravity
        ? 0.35 + airflowCmS * 0.25
        : airflowCmS <= 24
        ? 0.85 + (airflowCmS / 24) * 1.15
        : Math.max(0.45, 2.0 - (airflowCmS - 24) * 0.06);

    const o2Factor = Math.max(0.08, (oxygenPct - 12.5) / 8.5);
    const pressureFactor = Math.pow(pressureKpa / 101.3, 0.35);
    const tempFactor = 1.0 + (fuelTempK - 298) / 550;

    // Reduced gravity eliminates upward buoyant cooling, letting concurrent cabin flow sustain faster spread
    const gravitySpreadBoost = isMicrogravity && airflowCmS >= 4 ? 1.38 : 1.0 - gravityG * 0.12;

    const estSpreadMmS = Number(
      Math.max(
        0.05,
        2.1 * fuel.spreadFactor * o2Factor * flowFactor * pressureFactor * tempFactor * gravitySpreadBoost
      ).toFixed(2)
    );

    const estPeakTempK = Math.round(
      Math.min(2550, Math.max(780, 1250 + (oxygenPct - 14) * 48 + (pressureKpa - 50) * 1.6 + fuel.tempOffset))
    );

    const aspectRatio = Number((1.0 + gravityG * 1.9 + airflowCmS * 0.03).toFixed(2));
    const nearExtinction =
      oxygenPct < fuel.locBase || (isMicrogravity && airflowCmS < 0.8 && oxygenPct < 17.5);
    const coolFlamePossible =
      fuelType.includes('Droplet') && isMicrogravity && airflowCmS < 2.5 && oxygenPct <= 21.5;

    const regimeLabel = nearExtinction
      ? 'Near Extinction / Quenching Limit'
      : coolFlamePossible
      ? 'Dual-Stage / Cool-Flame Susceptible'
      : isMicrogravity && airflowCmS >= 6
      ? 'Ventilation-Enhanced Microgravity Spread'
      : isMicrogravity
      ? 'Diffusion-Controlled Spherical Flame'
      : 'Buoyancy-Dominated Natural Convection';

    return {
      estSpreadMmS,
      estPeakTempK,
      aspectRatio,
      effectiveVelCmS: Number(effectiveVelCmS.toFixed(1)),
      buoyantVelCmS: Number(buoyantVelCmS.toFixed(1)),
      regimeLabel,
      nearExtinction,
      coolFlamePossible,
      locLimit: fuel.locBase,
    };
  }, [gravityG, oxygenPct, pressureKpa, airflowCmS, fuelTempK, fuelType]);

  const handleReset = () => {
    setGravityG(0.0);
    setOxygenPct(21.0);
    setPressureKpa(101.3);
    setAirflowCmS(10.0);
    setFuelTempK(350);
    setFuelType('Cast PMMA');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#00D9FF] mb-1">
            Interactive Physics Approximation Lab
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#F8FAFC]">
            Microgravity Combustion Simulator
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGravityG(1.0)}
            className={`rounded-md px-3.5 py-2 text-xs font-mono font-medium border transition-colors cursor-pointer ${
              gravityG >= 0.9
                ? 'border-[#F59E0B] bg-[#F59E0B]/20 text-[#F59E0B]'
                : 'border-slate-700 bg-[#0B1628] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            EARTH: 1g
          </button>
          <button
            type="button"
            onClick={() => setGravityG(0.0)}
            className={`rounded-md px-3.5 py-2 text-xs font-mono font-medium border transition-colors cursor-pointer ${
              gravityG < 0.05
                ? 'border-[#00D9FF] bg-[#00D9FF]/20 text-[#00D9FF]'
                : 'border-slate-700 bg-[#0B1628] text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            MICROGRAVITY: ~0g
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-[#0B1628] px-3 py-2 text-xs text-[#CBD5E1] hover:text-white cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Explicit Approximation Notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-[#0B1628] px-4 py-3 text-xs text-[#CBD5E1]">
        <Info className="h-4 w-4 text-[#00D9FF] shrink-0 mt-0.5" />
        <span>
          <strong>Documented Analytical Approximation:</strong> This interactive chamber couples a Three.js GLSL
          morphological flame shader with empirical buoyancy-convection scaling laws (not a validated computational fluid
          dynamics solver). Drag inside the 3D viewport to orbit and inspect flame geometry.
        </span>
      </div>

      {/* Asymmetric Split Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Column */}
        <aside className="lg:col-span-4 rounded-lg border border-slate-800 bg-[#0B1628] p-5 space-y-5">
          <h2 className="font-display text-base font-semibold text-[#F8FAFC] border-b border-slate-800 pb-3">
            Environmental &amp; Fuel Controls
          </h2>

          <div>
            <label className="block font-mono text-xs text-[#94A3B8] mb-1.5">Fuel / Material</label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              className="w-full rounded border border-slate-700 bg-[#050B18] px-3 py-2 text-xs text-[#F8FAFC]"
            >
              {Object.entries(FUEL_MODIFIERS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#94A3B8]">Gravity Condition</span>
              <span className="text-[#00D9FF] font-mono-tabular">
                {gravityG < 0.01 ? '~0.00 g (Freefall)' : `${gravityG.toFixed(2)} g`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={gravityG}
              onChange={(e) => setGravityG(Number(e.target.value))}
              className="w-full accent-[#00D9FF]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#94A3B8]">Oxygen Concentration</span>
              <span className="text-[#F8FAFC] font-mono-tabular">{oxygenPct.toFixed(1)} % vol</span>
            </div>
            <input
              type="range"
              min={14}
              max={35}
              step={0.5}
              value={oxygenPct}
              onChange={(e) => setOxygenPct(Number(e.target.value))}
              className="w-full accent-[#2563EB]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#94A3B8]">Environmental Pressure</span>
              <span className="text-[#F8FAFC] font-mono-tabular">{pressureKpa.toFixed(1)} kPa</span>
            </div>
            <input
              type="range"
              min={50}
              max={120}
              step={1}
              value={pressureKpa}
              onChange={(e) => setPressureKpa(Number(e.target.value))}
              className="w-full accent-[#2563EB]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#94A3B8]">Forced Airflow Velocity</span>
              <span className="text-[#00D9FF] font-mono-tabular">{airflowCmS.toFixed(1)} cm/s</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={0.5}
              value={airflowCmS}
              onChange={(e) => setAirflowCmS(Number(e.target.value))}
              className="w-full accent-[#00D9FF]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#94A3B8]">Initial Fuel Temperature</span>
              <span className="text-[#F59E0B] font-mono-tabular">{fuelTempK} K</span>
            </div>
            <input
              type="range"
              min={290}
              max={650}
              step={5}
              value={fuelTempK}
              onChange={(e) => setFuelTempK(Number(e.target.value))}
              className="w-full accent-[#F59E0B]"
            />
          </div>
        </aside>

        {/* Right 3D Stage + Real-Time Physics Outputs */}
        <div className="lg:col-span-8 space-y-5">
          <div className="relative">
            <FlameSimulator3D
              heightClass="h-[380px]"
              params={{
                gravityG,
                oxygenPct,
                pressureKpa,
                airflowCmS,
                fuelTempK,
                fuelType,
              }}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#94A3B8]">
              <span>Regime: <strong className="text-[#00D9FF]">{simOutputs.regimeLabel}</strong></span>
              <span>Conceptual 3D Simulation · Drag to orbit · Scroll to zoom</span>
            </div>
          </div>

          {/* Calculated Outputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4">
              <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Est. Spread Rate</p>
              <p className="mt-1 font-mono-tabular text-xl font-bold text-[#00D9FF]">
                {simOutputs.estSpreadMmS} <span className="text-xs font-normal text-[#94A3B8]">mm/s</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4">
              <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Est. Peak Temp</p>
              <p className="mt-1 font-mono-tabular text-xl font-bold text-[#F59E0B]">
                {simOutputs.estPeakTempK} <span className="text-xs font-normal text-[#94A3B8]">K</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4">
              <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Effective Flow</p>
              <p className="mt-1 font-mono-tabular text-xl font-bold text-[#F8FAFC]">
                {simOutputs.effectiveVelCmS} <span className="text-xs font-normal text-[#94A3B8]">cm/s</span>
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-4">
              <p className="font-mono text-[11px] uppercase text-[#94A3B8]">Flame Aspect H/W</p>
              <p className="mt-1 font-mono-tabular text-xl font-bold text-[#8B5CF6]">
                {simOutputs.aspectRatio} <span className="text-xs font-normal text-[#94A3B8]">ratio</span>
              </p>
            </div>
          </div>

          {/* Physics Explanation Panel */}
          <div className="rounded-lg border border-slate-800 bg-[#0B1628] p-5 space-y-3 text-xs leading-relaxed text-[#CBD5E1]">
            <h3 className="font-display text-sm font-semibold text-[#F8FAFC]">
              Buoyancy, Convection &amp; Parameter Sensitivity Analysis
            </h3>
            <p>
              <strong className="text-[#00D9FF]">Gravity &amp; Buoyancy Effect:</strong>{' '}
              {gravityG < 0.05
                ? `At ~0g, natural buoyant convection collapses (buoyant velocity ~${simOutputs.buoyantVelCmS} cm/s). Hot exhaust gases do not rise away from the fuel, producing a near-spherical diffusion flame with a dimmer blue reaction edge and radial soot trapping.`
                : `At ${gravityG.toFixed(2)}g, density differences drive an upward buoyant plume (~${simOutputs.buoyantVelCmS} cm/s induced flow), stretching the flame into a luminous yellow-orange teardrop and drawing fresh cool oxidizer into the base.`}
            </p>
            <p>
              <strong className="text-[#F59E0B]">Airflow &amp; Oxygen Margin:</strong>{' '}
              {simOutputs.nearExtinction
                ? `Oxygen (${oxygenPct}%) is near or below the reference limiting threshold (~${simOutputs.locLimit}% for ${fuelType}), increasing radiative quenching or blow-off extinction probability.`
                : simOutputs.coolFlamePossible
                ? `In quiescent microgravity droplet conditions, visible hot flames may extinguish radiatively while invisible low-temperature cool-flame oxidation persists.`
                : `With ${airflowCmS.toFixed(1)} cm/s forced flow and ${oxygenPct.toFixed(1)}% O2 at ${pressureKpa} kPa, oxidizer transport directly feeds the reaction front without excessive convective cooling.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
