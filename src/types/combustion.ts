export type DataOrigin =
  | 'NASA_OSDR_LIVE'
  | 'NASA_CURATED_LITERATURE'
  | 'USER_UPLOADED'
  | 'OFFLINE_DEMO_SAMPLE';

export type RiskLevel = 'LOW RISK' | 'MODERATE RISK' | 'ELEVATED RISK' | 'HIGH RISK';

export interface InvestigationProfile {
  id: string;
  code: string;
  name: string;
  fullTitle: string;
  facility: string;
  gravityEnvironment: string;
  fuelMaterials: string[];
  objective: string;
  methodology: string;
  keyParameters: string[];
  scientificFindings: string[];
  safetyRelevance: string;
  dataAvailability: string;
  sourceUrl: string;
  secondaryUrl?: string;
  datasetIdentifier: string;
}

export interface CombustionRecord {
  id: string;
  datasetId: string;
  experimentName: string;
  gravityCondition: 'Microgravity (~0g)' | 'Earth Gravity (1g)' | 'Partial Gravity (0.16g-0.38g)';
  gravityG: number;
  fuelType: string;
  oxygenPct: number;
  pressureKpa: number;
  airflowCmS: number;
  fuelTempK: number;
  flameSpreadMmS: number | null;
  ignitionDelayS: number | null;
  extinctionO2Pct: number | null;
  heatReleaseKwM2: number | null;
  peakFlameTempK: number | null;
  experimentalCondition: string;
  ignitionOutcome: 'Sustained Flame' | 'Cool Flame' | 'Extinguished' | 'No Ignition';
  riskLabel: RiskLevel;
  dataOrigin: DataOrigin;
  sourceReference: string;
  sourceUrl: string;
  recordedYear: number;
}

export interface OsdrStudyMetadata {
  accession: string;
  title: string;
  description: string;
  studyType: string;
  organismOrMaterial: string;
  factorSummary: string;
  releaseDate: string;
  studyUrl: string;
  dataOrigin: 'NASA_OSDR_LIVE' | 'OFFLINE_DEMO_SAMPLE';
}

export interface SourceHealthStatus {
  id: string;
  name: string;
  url: string;
  status: 'CONNECTED' | 'DEGRADED' | 'OFFLINE';
  httpStatus: number | null;
  latencyMs: number | null;
  lastCheckedAt: string;
  lastSuccessAt: string | null;
  notes: string;
}

export interface CorrelationPair {
  varA: string;
  varB: string;
  labelA: string;
  labelB: string;
  r: number;
  n: number;
}

export interface FeatureImportanceItem {
  feature: string;
  label: string;
  unit: string;
  standardizedWeight: number;
  importancePct: number;
  direction: 'positive' | 'negative';
}

export interface PredictionActualPoint {
  id: string;
  experimentName: string;
  actualMmS: number;
  predictedMmS: number;
  split: 'train' | 'test';
}

export interface DataInsightItem {
  id: string;
  category: 'Propagation' | 'Gravity Effect' | 'Ignition & Extinction' | 'Anomaly Watch' | 'Environmental';
  title: string;
  finding: string;
  evidenceMetric: string;
  datasetScope: string;
}

export interface MlAnalysisResponse {
  modelType: string;
  targetVariable: string;
  targetUnit: string;
  sampleCount: number;
  trainCount: number;
  testCount: number;
  metrics: {
    trainR2: number;
    testR2: number;
    cvR2: number;
    rmseMmS: number;
    maeMmS: number;
    residualStdMmS: number;
  };
  featureImportance: FeatureImportanceItem[];
  correlations: CorrelationPair[];
  actualVsPredicted: PredictionActualPoint[];
  riskDistribution: Record<RiskLevel, number>;
  gravityComparison: {
    microgravityCount: number;
    earthGravityCount: number;
    avgSpreadMicrogravityMmS: number;
    avgSpreadEarthMmS: number;
    avgExtinctionO2MicrogravityPct: number | null;
    avgExtinctionO2EarthPct: number | null;
    avgIgnitionDelayMicrogravityS: number | null;
    avgIgnitionDelayEarthS: number | null;
    methodologicalNote: string;
  };
  insights: DataInsightItem[];
  limitations: string[];
  disclaimer: string;
  trainedAt: string;
}

export interface RiskPredictionResult {
  inputs: {
    oxygenPct: number;
    pressureKpa: number;
    airflowCmS: number;
    fuelTempK: number;
    gravityG: number;
    fuelType: string;
  };
  predictedFlameSpreadMmS: number;
  confidenceIntervalMmS: [number, number];
  riskLevel: RiskLevel;
  compositeRiskIndex: number;
  contributingVariables: {
    variable: string;
    valueFormatted: string;
    impact: 'High' | 'Moderate' | 'Low';
    rationale: string;
  }[];
  matchedHistoricalRecords: CombustionRecord[];
  recommendedInvestigations: string[];
  modelLimitations: string[];
  disclaimer: string;
}

export interface OverviewPayload {
  metrics: {
    experimentsAnalysed: number;
    availableRecords: number;
    avgFlameSpreadMmS: number;
    detectedHighRiskCount: number;
    microgravityRecords: number;
    earthComparisonRecords: number;
  };
  investigations: InvestigationProfile[];
  sources: SourceHealthStatus[];
  osdrStudiesCount: number;
  lastSyncAt: string | null;
  backendHealth: {
    apiStatus: 'ONLINE';
    databaseEngine: string;
    mlEngineStatus: 'READY' | 'INSUFFICIENT_DATA';
    geminiConfigured: boolean;
    uptimeSeconds: number;
  };
}
