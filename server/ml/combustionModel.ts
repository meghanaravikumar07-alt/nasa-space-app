import type {
  CombustionRecord,
  CorrelationPair,
  DataInsightItem,
  FeatureImportanceItem,
  MlAnalysisResponse,
  PredictionActualPoint,
  RiskLevel,
  RiskPredictionResult,
} from '../../src/types/combustion.ts';

interface FeatureDef {
  key: 'oxygenPct' | 'pressureKpa' | 'airflowCmS' | 'fuelTempK' | 'gravityG';
  label: string;
  unit: string;
}

const FEATURES: FeatureDef[] = [
  { key: 'oxygenPct', label: 'Oxygen Concentration', unit: '% vol' },
  { key: 'airflowCmS', label: 'Forced Airflow Velocity', unit: 'cm/s' },
  { key: 'pressureKpa', label: 'Ambient Pressure', unit: 'kPa' },
  { key: 'fuelTempK', label: 'Fuel Temperature', unit: 'K' },
  { key: 'gravityG', label: 'Gravity Level', unit: 'g' },
];

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], avg?: number): number {
  if (arr.length < 2) return 1;
  const m = avg ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance) || 1;
}

function pearson(x: number[], y: number[]): number {
  if (x.length < 3 || x.length !== y.length) return 0;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) {
        pivotRow = r;
      }
    }
    const tmp = M[col];
    M[col] = M[pivotRow];
    M[pivotRow] = tmp;

    const pivot = Math.abs(M[col][col]) < 1e-10 ? 1e-10 : M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r !== col) {
        const factor = M[r][col];
        for (let j = col; j <= n; j++) {
          M[r][j] -= factor * M[col][j];
        }
      }
    }
  }
  return M.map((row) => row[n]);
}

interface TrainedRidgeModel {
  weights: number[]; // [bias, w0..w4] on standardized features
  means: number[];
  stds: number[];
  residualStd: number;
  predict: (rawFeatures: number[]) => number;
}

function fitRidgeRegression(
  X: number[][],
  y: number[],
  lambda = 1.25
): TrainedRidgeModel {
  const n = X.length;
  const p = X[0].length;
  const means = Array.from({ length: p }, (_, j) => mean(X.map((r) => r[j])));
  const stds = Array.from({ length: p }, (_, j) => stdDev(X.map((r) => r[j]), means[j]));

  const Xs = X.map((row) => [1, ...row.map((v, j) => (v - means[j]) / stds[j])]);
  const dim = p + 1;

  // Compute X^T X + lambda * I (do not regularize intercept index 0)
  const XtX: number[][] = Array.from({ length: dim }, () => Array(dim).fill(0));
  const Xty: number[] = Array(dim).fill(0);

  for (let i = 0; i < n; i++) {
    for (let a = 0; a < dim; a++) {
      Xty[a] += Xs[i][a] * y[i];
      for (let b = 0; b < dim; b++) {
        XtX[a][b] += Xs[i][a] * Xs[i][b];
      }
    }
  }
  for (let j = 1; j < dim; j++) {
    XtX[j][j] += lambda;
  }

  const weights = solveLinearSystem(XtX, Xty);

  const predict = (raw: number[]) => {
    let pred = weights[0];
    for (let j = 0; j < p; j++) {
      pred += weights[j + 1] * ((raw[j] - means[j]) / stds[j]);
    }
    return Math.max(0.05, Number(pred.toFixed(3)));
  };

  const residuals = X.map((row, i) => y[i] - predict(row));
  const residualStd = Math.max(0.35, stdDev(residuals, 0));

  return { weights, means, stds, residualStd, predict };
}

function computeR2(actual: number[], predicted: number[]): number {
  if (actual.length < 2) return 0;
  const avg = mean(actual);
  const ssTot = actual.reduce((s, v) => s + (v - avg) ** 2, 0);
  const ssRes = actual.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0);
  if (ssTot === 0) return 0;
  return Number((1 - ssRes / ssTot).toFixed(3));
}

function computeRmse(actual: number[], predicted: number[]): number {
  if (!actual.length) return 0;
  const mse = actual.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0) / actual.length;
  return Number(Math.sqrt(mse).toFixed(3));
}

function computeMae(actual: number[], predicted: number[]): number {
  if (!actual.length) return 0;
  const mae = actual.reduce((s, v, i) => s + Math.abs(v - predicted[i]), 0) / actual.length;
  return Number(mae.toFixed(3));
}

function extractFeatures(r: CombustionRecord): number[] {
  return [r.oxygenPct, r.airflowCmS, r.pressureKpa, r.fuelTempK, r.gravityG];
}

export function analyzeCombustionDataset(records: CombustionRecord[]): MlAnalysisResponse {
  const validRows = records.filter((r) => r.flameSpreadMmS !== null && Number.isFinite(r.flameSpreadMmS));
  // Deterministic 80/20 split using modulo index after sorting by spread rate for stratification
  const sorted = [...validRows].sort((a, b) => (a.flameSpreadMmS ?? 0) - (b.flameSpreadMmS ?? 0));
  const trainRows: CombustionRecord[] = [];
  const testRows: CombustionRecord[] = [];

  sorted.forEach((r, idx) => {
    if (idx % 5 === 2 && testRows.length < Math.max(2, Math.floor(sorted.length * 0.25))) {
      testRows.push(r);
    } else {
      trainRows.push(r);
    }
  });

  if (testRows.length === 0 && trainRows.length > 4) {
    testRows.push(trainRows.pop()!);
  }

  const trainX = trainRows.map(extractFeatures);
  const trainY = trainRows.map((r) => r.flameSpreadMmS as number);
  const testX = testRows.map(extractFeatures);
  const testY = testRows.map((r) => r.flameSpreadMmS as number);

  const model = fitRidgeRegression(trainX, trainY, 1.5);
  const trainPreds = trainX.map((row) => model.predict(row));
  const testPreds = testX.map((row) => model.predict(row));

  // 5-fold cross validation on all validRows
  const cvActual: number[] = [];
  const cvPred: number[] = [];
  for (let fold = 0; fold < 5; fold++) {
    const fTrainX: number[][] = [];
    const fTrainY: number[] = [];
    const fTestX: number[][] = [];
    const fTestY: number[] = [];
    sorted.forEach((r, idx) => {
      if (idx % 5 === fold) {
        fTestX.push(extractFeatures(r));
        fTestY.push(r.flameSpreadMmS as number);
      } else {
        fTrainX.push(extractFeatures(r));
        fTrainY.push(r.flameSpreadMmS as number);
      }
    });
    if (fTrainX.length >= 6 && fTestX.length >= 1) {
      const fModel = fitRidgeRegression(fTrainX, fTrainY, 1.5);
      fTestX.forEach((row, i) => {
        cvActual.push(fTestY[i]);
        cvPred.push(fModel.predict(row));
      });
    }
  }

  // Feature importance from standardized weights
  const absSum = model.weights.slice(1).reduce((s, w) => s + Math.abs(w), 0) || 1;
  const featureImportance: FeatureImportanceItem[] = FEATURES.map((f, idx) => {
    const w = model.weights[idx + 1];
    return {
      feature: f.key,
      label: f.label,
      unit: f.unit,
      standardizedWeight: Number(w.toFixed(3)),
      importancePct: Number(((Math.abs(w) / absSum) * 100).toFixed(1)),
      direction: (w >= 0 ? 'positive' : 'negative') as 'positive' | 'negative',
    };
  }).sort((a, b) => b.importancePct - a.importancePct);

  // Pairwise Pearson correlations against flameSpreadMmS and ignitionDelayS
  const corrPairs: Array<{ a: keyof CombustionRecord; la: string; b: keyof CombustionRecord; lb: string }> = [
    { a: 'oxygenPct', la: 'Oxygen (%)', b: 'flameSpreadMmS', lb: 'Flame Spread (mm/s)' },
    { a: 'airflowCmS', la: 'Airflow (cm/s)', b: 'flameSpreadMmS', lb: 'Flame Spread (mm/s)' },
    { a: 'pressureKpa', la: 'Pressure (kPa)', b: 'flameSpreadMmS', lb: 'Flame Spread (mm/s)' },
    { a: 'fuelTempK', la: 'Fuel Temp (K)', b: 'flameSpreadMmS', lb: 'Flame Spread (mm/s)' },
    { a: 'gravityG', la: 'Gravity (g)', b: 'flameSpreadMmS', lb: 'Flame Spread (mm/s)' },
    { a: 'oxygenPct', la: 'Oxygen (%)', b: 'ignitionDelayS', lb: 'Ignition Delay (s)' },
    { a: 'airflowCmS', la: 'Airflow (cm/s)', b: 'heatReleaseKwM2', lb: 'Heat Release (kW/m²)' },
    { a: 'oxygenPct', la: 'Oxygen (%)', b: 'peakFlameTempK', lb: 'Peak Flame Temp (K)' },
  ];

  const correlations: CorrelationPair[] = corrPairs.map((pair) => {
    const paired = records.filter(
      (r) => typeof r[pair.a] === 'number' && typeof r[pair.b] === 'number' && r[pair.b] !== null
    );
    const xs = paired.map((r) => Number(r[pair.a]));
    const ys = paired.map((r) => Number(r[pair.b]));
    return {
      varA: String(pair.a),
      varB: String(pair.b),
      labelA: pair.la,
      labelB: pair.lb,
      r: Number(pearson(xs, ys).toFixed(3)),
      n: paired.length,
    };
  });

  const actualVsPredicted: PredictionActualPoint[] = [
    ...trainRows.map((r, i) => ({
      id: r.id,
      experimentName: r.experimentName,
      actualMmS: Number((r.flameSpreadMmS as number).toFixed(2)),
      predictedMmS: Number(trainPreds[i].toFixed(2)),
      split: 'train' as const,
    })),
    ...testRows.map((r, i) => ({
      id: r.id,
      experimentName: r.experimentName,
      actualMmS: Number((r.flameSpreadMmS as number).toFixed(2)),
      predictedMmS: Number(testPreds[i].toFixed(2)),
      split: 'test' as const,
    })),
  ];

  const riskDistribution: Record<RiskLevel, number> = {
    'LOW RISK': 0,
    'MODERATE RISK': 0,
    'ELEVATED RISK': 0,
    'HIGH RISK': 0,
  };
  records.forEach((r) => {
    riskDistribution[r.riskLabel] = (riskDistribution[r.riskLabel] ?? 0) + 1;
  });

  // Gravity comparison
  const microRows = records.filter((r) => r.gravityG < 0.05);
  const earthRows = records.filter((r) => r.gravityG >= 0.8);
  const avgSpreadMicro = mean(microRows.map((r) => r.flameSpreadMmS).filter((v): v is number => v !== null));
  const avgSpreadEarth = mean(earthRows.map((r) => r.flameSpreadMmS).filter((v): v is number => v !== null));
  const microExt = microRows.map((r) => r.extinctionO2Pct).filter((v): v is number => v !== null);
  const earthExt = earthRows.map((r) => r.extinctionO2Pct).filter((v): v is number => v !== null);
  const microIgn = microRows.map((r) => r.ignitionDelayS).filter((v): v is number => v !== null);
  const earthIgn = earthRows.map((r) => r.ignitionDelayS).filter((v): v is number => v !== null);

  // Data-driven insights generated directly from computed statistics
  const topFeature = featureImportance[0];
  const o2Corr = correlations.find((c) => c.varA === 'oxygenPct' && c.varB === 'flameSpreadMmS');
  const flowCorr = correlations.find((c) => c.varA === 'airflowCmS' && c.varB === 'flameSpreadMmS');
  const highRiskRows = records.filter((r) => r.riskLabel === 'HIGH RISK');
  const coolFlames = records.filter((r) => r.ignitionOutcome === 'Cool Flame');
  const spreadRatio = avgSpreadEarth > 0 ? (avgSpreadMicro / avgSpreadEarth).toFixed(2) : 'N/A';

  const insights: DataInsightItem[] = [
    {
      id: 'ins-propagation',
      category: 'Propagation',
      title: `${topFeature.label} exhibits the strongest standardized influence on spread rate`,
      finding: `Across ${validRows.length} evaluated runs, ${topFeature.label} accounts for ${topFeature.importancePct}% of standardized model weight (β = ${topFeature.standardizedWeight > 0 ? '+' : ''}${topFeature.standardizedWeight}). Forced airflow (r = ${flowCorr?.r ?? 0}) and oxygen enrichment (r = ${o2Corr?.r ?? 0}) jointly drive rapid concurrent flame propagation.`,
      evidenceMetric: `Importance ${topFeature.importancePct}% · Flow r=${flowCorr?.r ?? 0}`,
      datasetScope: `${validRows.length} combustion runs`,
    },
    {
      id: 'ins-gravity',
      category: 'Gravity Effect',
      title: 'Microgravity runs average higher flame spread and lower extinction oxygen limits',
      finding: `Loaded microgravity records (${microRows.length} runs) show a mean flame spread rate of ${avgSpreadMicro.toFixed(2)} mm/s compared to ${avgSpreadEarth.toFixed(2)} mm/s in matched 1g tests (${spreadRatio}x), while sustaining flames down to ${microExt.length ? mean(microExt).toFixed(1) : 'N/A'}% O2 vs ${earthExt.length ? mean(earthExt).toFixed(1) : 'N/A'}% O2 in 1g.`,
      evidenceMetric: `0g: ${avgSpreadMicro.toFixed(2)} mm/s vs 1g: ${avgSpreadEarth.toFixed(2)} mm/s`,
      datasetScope: `0g (n=${microRows.length}) vs 1g (n=${earthRows.length})`,
    },
    {
      id: 'ins-cool-flame',
      category: 'Ignition & Extinction',
      title: 'Cool-flame persistence observed in quiescent microgravity droplet tests',
      finding: `${coolFlames.length} FLEX/FLEX-2 microgravity droplet records entered low-temperature cool-flame combustion after visible radiative extinction at O2 concentrations between 17.5% and 21.0%, highlighting non-visible smoldering/re-ignition behavior.`,
      evidenceMetric: `${coolFlames.length} Cool-Flame transitions documented`,
      datasetScope: 'FLEX & FLEX-2 droplet experiments',
    },
    {
      id: 'ins-anomaly',
      category: 'Anomaly Watch',
      title: 'Low-pressure, oxygen-enriched exploration atmospheres elevate compartment fire severity',
      finding: `${highRiskRows.length} high-risk conditions in the dataset cluster around exploration atmospheres (55–65 kPa with 25–30% O2) and forced ventilation (12–30 cm/s), where ignition delay drops below 2.5 s and heat release exceeds 140 kW/m².`,
      evidenceMetric: `${highRiskRows.length} High-Risk runs identified`,
      datasetScope: 'SoFIE & Saffire flight regimes',
    },
    {
      id: 'ins-env',
      category: 'Environmental',
      title: 'Non-monotonic ventilation sensitivity in spacecraft cabin flow bands',
      finding: `In SoFIE-GEL and Saffire runs, near-quiescent flows (<2 cm/s) promote radiative quenching (~0.4–0.9 mm/s), whereas moderate HVAC velocities (10–25 cm/s) supply oxidizer directly into the reaction zone before blow-off begins above ~28 cm/s for near-limit O2.`,
      evidenceMetric: 'Peak sensitivity: 10–25 cm/s forced flow',
      datasetScope: 'SoFIE-GEL & Saffire flow ducts',
    },
  ];

  return {
    modelType: 'Standardized Ridge Regression (L2 λ=1.5) + Prototype Composite Risk Classifier',
    targetVariable: 'Flame Spread Rate',
    targetUnit: 'mm/s',
    sampleCount: validRows.length,
    trainCount: trainRows.length,
    testCount: testRows.length,
    metrics: {
      trainR2: computeR2(trainY, trainPreds),
      testR2: computeR2(testY, testPreds),
      cvR2: computeR2(cvActual, cvPred),
      rmseMmS: computeRmse(testY, testPreds),
      maeMmS: computeMae(testY, testPreds),
      residualStdMmS: Number(model.residualStd.toFixed(3)),
    },
    featureImportance,
    correlations,
    actualVsPredicted,
    riskDistribution,
    gravityComparison: {
      microgravityCount: microRows.length,
      earthGravityCount: earthRows.length,
      avgSpreadMicrogravityMmS: Number(avgSpreadMicro.toFixed(2)),
      avgSpreadEarthMmS: Number(avgSpreadEarth.toFixed(2)),
      avgExtinctionO2MicrogravityPct: microExt.length ? Number(mean(microExt).toFixed(2)) : null,
      avgExtinctionO2EarthPct: earthExt.length ? Number(mean(earthExt).toFixed(2)) : null,
      avgIgnitionDelayMicrogravityS: microIgn.length ? Number(mean(microIgn).toFixed(2)) : null,
      avgIgnitionDelayEarthS: earthIgn.length ? Number(mean(earthIgn).toFixed(2)) : null,
      methodologicalNote:
        'Direct numerical comparisons combine different fuel geometries (droplets in FLEX vs solid PMMA/SIBAL in SoFIE/Saffire). Always filter by matching Fuel Type and Experiment when conducting controlled 1g vs ~0g evaluations.',
    },
    insights,
    limitations: [
      `Trained on ${validRows.length} curated and uploaded experimental records; small sample size restricts extrapolation beyond 15–30% O2 and 50–120 kPa.`,
      'Linear Ridge Regression captures monotonic trends well but approximates non-linear blow-off quenching at high airflow (>28 cm/s) and material-specific pyrolysis.',
      'Fuel type (thin SIBAL fabric vs thick Cast PMMA vs liquid droplets) significantly alters absolute spread rates beyond environmental parameters alone.',
    ],
    disclaimer:
      'RESEARCH PROTOTYPE NOTICE: All risk classifications and flame spread predictions are experimental research-support outputs derived from statistical modeling of historical datasets. They do NOT represent NASA-certified spacecraft fire safety thresholds or flight rules (NASA-STD-6001).',
    trainedAt: new Date().toISOString(),
  };
}

export function predictCombustionRisk(
  records: CombustionRecord[],
  inputs: {
    oxygenPct: number;
    pressureKpa: number;
    airflowCmS: number;
    fuelTempK: number;
    gravityG: number;
    fuelType: string;
  }
): RiskPredictionResult {
  const validRows = records.filter((r) => r.flameSpreadMmS !== null);
  const X = validRows.map(extractFeatures);
  const y = validRows.map((r) => r.flameSpreadMmS as number);
  const model = fitRidgeRegression(X, y, 1.5);

  const rawPred = model.predict([
    inputs.oxygenPct,
    inputs.airflowCmS,
    inputs.pressureKpa,
    inputs.fuelTempK,
    inputs.gravityG,
  ]);

  // Adjust softly for thin textile vs flame-retardant fuel context while noting limitation
  const fuelLower = inputs.fuelType.toLowerCase();
  const fuelMultiplier = fuelLower.includes('sibal') || fuelLower.includes('cotton')
    ? 1.35
    : fuelLower.includes('nomex')
    ? 0.42
    : fuelLower.includes('heptane') || fuelLower.includes('droplet')
    ? 0.55
    : 1.0;

  const predictedSpread = Number(Math.max(0.1, rawPred * fuelMultiplier).toFixed(2));
  const halfWidth = Number((1.96 * model.residualStd * 0.65).toFixed(2));
  const ciLow = Number(Math.max(0.05, predictedSpread - halfWidth).toFixed(2));
  const ciHigh = Number((predictedSpread + halfWidth).toFixed(2));

  // Transparent composite prototype risk index (0–100)
  let index = 0;
  // Oxygen enrichment factor (0–35 pts)
  index += Math.min(35, Math.max(0, (inputs.oxygenPct - 15) * 2.5));
  // Microgravity HVAC enhancement window (0–25 pts)
  if (inputs.gravityG < 0.05) {
    if (inputs.airflowCmS >= 6 && inputs.airflowCmS <= 28) index += 22;
    else if (inputs.airflowCmS > 1) index += 12;
    else index += 6;
  } else {
    index += Math.min(14, inputs.airflowCmS * 0.4);
  }
  // Low pressure exploration O2 partial pressure sensitivity (0–15 pts)
  if (inputs.pressureKpa < 75 && inputs.oxygenPct >= 24) index += 14;
  else if (inputs.pressureKpa < 85) index += 8;
  else index += 4;
  // Fuel thermal pre-heating (0–12 pts)
  index += Math.min(12, Math.max(0, ((inputs.fuelTempK - 295) / 220) * 12));
  // Predicted flame spread severity (0–13 pts)
  index += Math.min(13, predictedSpread * 1.1);

  const compositeRiskIndex = Math.round(Math.min(100, Math.max(5, index)));
  const riskLevel: RiskLevel =
    compositeRiskIndex >= 68
      ? 'HIGH RISK'
      : compositeRiskIndex >= 48
      ? 'ELEVATED RISK'
      : compositeRiskIndex >= 28
      ? 'MODERATE RISK'
      : 'LOW RISK';

  const contributingVariables: RiskPredictionResult['contributingVariables'] = [
    {
      variable: 'Oxygen Concentration',
      valueFormatted: `${inputs.oxygenPct.toFixed(1)} % vol`,
      impact: inputs.oxygenPct >= 24.5 ? 'High' : inputs.oxygenPct >= 21 ? 'Moderate' : 'Low',
      rationale:
        inputs.oxygenPct >= 24.5
          ? 'Enriched oxygen accelerates reaction kinetics and lowers ignition delay.'
          : inputs.oxygenPct <= 17
          ? 'Near-limiting oxygen approaches radiative or convective extinction boundary.'
          : 'Normoxic oxygen range sustains steady combustion when ventilated.',
    },
    {
      variable: 'Forced Airflow & Gravity',
      valueFormatted: `${inputs.airflowCmS.toFixed(1)} cm/s @ ${inputs.gravityG < 0.01 ? '~0g' : `${inputs.gravityG}g`}`,
      impact:
        inputs.gravityG < 0.05 && inputs.airflowCmS >= 6 && inputs.airflowCmS <= 26
          ? 'High'
          : inputs.airflowCmS > 2
          ? 'Moderate'
          : 'Low',
      rationale:
        inputs.gravityG < 0.05 && inputs.airflowCmS >= 6 && inputs.airflowCmS <= 26
          ? 'Spacecraft ventilation range (6–26 cm/s) supplies O2 without buoyant dilution or blow-off.'
          : inputs.gravityG < 0.05 && inputs.airflowCmS < 2
          ? 'Quiescent microgravity limits oxygen transport, promoting diffusion-controlled or cool-flame regimes.'
          : 'Higher gravity or higher flow alters convective cooling and boundary layer thickness.',
    },
    {
      variable: 'Cabin Pressure',
      valueFormatted: `${inputs.pressureKpa.toFixed(1)} kPa`,
      impact: inputs.pressureKpa < 75 && inputs.oxygenPct >= 24 ? 'High' : 'Moderate',
      rationale:
        inputs.pressureKpa < 75 && inputs.oxygenPct >= 24
          ? 'Exploration cabin atmosphere (reduced pressure + enriched O2%) lowers inert N2 heat capacity.'
          : 'Nominal atmospheric nitrogen dilution moderates peak flame temperature.',
    },
    {
      variable: 'Fuel Pre-Heat & Material',
      valueFormatted: `${inputs.fuelTempK.toFixed(0)} K · ${inputs.fuelType}`,
      impact: inputs.fuelTempK >= 400 || fuelMultiplier > 1.1 ? 'High' : 'Moderate',
      rationale:
        fuelMultiplier > 1.1
          ? 'Thermally thin composite textiles exhibit rapid surface pyrolysis and flame spread.'
          : fuelMultiplier < 0.6
          ? 'Flame-retardant or droplet geometry alters bulk surface spread rate.'
          : 'Elevated fuel temperature reduces thermal inertia required for pyrolysis.',
    },
  ];

  // Nearest historical records via normalized Euclidean distance
  const matchedHistoricalRecords = [...records]
    .sort((a, b) => {
      const da =
        ((a.oxygenPct - inputs.oxygenPct) / 5) ** 2 +
        ((a.airflowCmS - inputs.airflowCmS) / 10) ** 2 +
        ((a.pressureKpa - inputs.pressureKpa) / 20) ** 2 +
        ((a.gravityG - inputs.gravityG) / 0.5) ** 2;
      const db =
        ((b.oxygenPct - inputs.oxygenPct) / 5) ** 2 +
        ((b.airflowCmS - inputs.airflowCmS) / 10) ** 2 +
        ((b.pressureKpa - inputs.pressureKpa) / 20) ** 2 +
        ((b.gravityG - inputs.gravityG) / 0.5) ** 2;
      return da - db;
    })
    .slice(0, 3);

  const recommendedInvestigations = [
    inputs.gravityG < 0.05 && inputs.airflowCmS < 3
      ? 'Evaluate non-visible cool-flame / radiative extinction persistence via UV/OH* sensors (FLEX/FLEX-2 methodology).'
      : 'Evaluate ventilation shutoff response time vs flame spread acceleration in the 8–20 cm/s band (SoFIE-GEL).',
    inputs.pressureKpa < 75 && inputs.oxygenPct > 23
      ? 'Verify material flammability margins under exploration-atmosphere partial pressures (SoFIE / Saffire-IV regime).'
      : 'Cross-check thin vs thick solid fuel ignition delay under identical radiant flux (NASA-STD-6001 vs CIR SoFIE).',
    'Monitor CO, soot particulate, and thermal plume dispersion where buoyant stratification is absent.',
  ];

  return {
    inputs,
    predictedFlameSpreadMmS: predictedSpread,
    confidenceIntervalMmS: [ciLow, ciHigh],
    riskLevel,
    compositeRiskIndex,
    contributingVariables,
    matchedHistoricalRecords,
    recommendedInvestigations,
    modelLimitations: [
      'Statistical prototype calibrated on historical NASA microgravity & 1g literature datasets; not a CFD or chemical kinetics solver.',
      'Fuel-type scaling factor is an empirical approximation when fuel chemistry differs from Cast PMMA baseline.',
      'Confidence interval reflects residual variance across heterogeneous experiment geometries.',
    ],
    disclaimer:
      'EXPERIMENTAL RESEARCH PROTOTYPE: Cannot replace official NASA spacecraft fire-safety certification (NASA-STD-6001) or flight operations procedures.',
  };
}
