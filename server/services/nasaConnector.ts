import type {
  CombustionRecord,
  OsdrStudyMetadata,
  RiskLevel,
  SourceHealthStatus,
} from '../../src/types/combustion.ts';
import { getSourceHealth, saveOsdrStudies, saveSourceHealth } from '../db/database.ts';

const MONITORED_SOURCES = [
  {
    id: 'nasa-osdr',
    name: 'NASA Open Science Data Repository (OSDR)',
    url: 'https://osdr.nasa.gov/osdr/data/search?term=combustion&from=0&size=12',
  },
  {
    id: 'nasa-psi',
    name: 'NASA Physical Sciences Informatics (PSI)',
    url: 'https://psi.nasa.gov/',
  },
  {
    id: 'nasa-psi-flex',
    name: 'NASA FLEX Investigation (PSI-69)',
    url: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-69',
  },
  {
    id: 'nasa-psi-saffire',
    name: 'NASA Saffire Investigation (PSI-98)',
    url: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-98',
  },
  {
    id: 'nasa-sofie',
    name: 'NASA SoFIE Investigation Portal',
    url: 'https://science.nasa.gov/biological-physical/investigations/sofie/',
  },
  {
    id: 'nasa-combustion',
    name: 'NASA Glenn Combustion Science',
    url: 'https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/',
  },
];

async function fetchWithTimeout(url: string, timeoutMs = 6500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ORBITAL-X-Research-Platform/1.0',
        Accept: 'application/json, text/html, */*',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function classifyRecordRisk(
  oxygenPct: number,
  airflowCmS: number,
  flameSpreadMmS: number | null,
  gravityG: number
): RiskLevel {
  let score = 0;
  if (oxygenPct >= 25.0) score += 3;
  else if (oxygenPct >= 22.5) score += 2;
  else if (oxygenPct >= 20.5) score += 1;

  if (gravityG < 0.01 && airflowCmS >= 5 && airflowCmS <= 28) score += 2;
  else if (airflowCmS > 2) score += 1;

  if ((flameSpreadMmS ?? 0) >= 6.5) score += 3;
  else if ((flameSpreadMmS ?? 0) >= 3.5) score += 2;
  else if ((flameSpreadMmS ?? 0) >= 1.5) score += 1;

  if (score >= 6) return 'HIGH RISK';
  if (score >= 4) return 'ELEVATED RISK';
  if (score >= 2) return 'MODERATE RISK';
  return 'LOW RISK';
}

export async function syncNasaRepositories(): Promise<{
  sources: SourceHealthStatus[];
  fetchedStudies: OsdrStudyMetadata[];
  syncedAt: string;
}> {
  const existingHealth = await getSourceHealth();
  const previousMap = new Map(existingHealth.map((s) => [s.id, s]));
  const nowIso = new Date().toISOString();

  const updatedSources: SourceHealthStatus[] = [];
  const fetchedStudies: OsdrStudyMetadata[] = [];

  await Promise.all(
    MONITORED_SOURCES.map(async (src) => {
      const prev = previousMap.get(src.id);
      const t0 = Date.now();
      try {
        const res = await fetchWithTimeout(src.url, 6500);
        const latencyMs = Date.now() - t0;

        if (src.id === 'nasa-osdr' && res.ok) {
          const json = (await res.json()) as {
            hits?: {
              hits?: Array<{
                _id?: string;
                _source?: Record<string, unknown>;
              }>;
            };
          };
          const hits = json?.hits?.hits ?? [];
          for (const hit of hits.slice(0, 12)) {
            const s = hit._source ?? {};
            const accession = String(
              s['Accession'] || s['Study Identifier'] || hit._id || `OSDR-${fetchedStudies.length + 1}`
            );
            const title = String(s['Study Title'] || s['title'] || 'NASA OSDR Spaceflight Study');
            const description = String(
              s['Study Description'] || s['description'] || 'Retrieved from NASA Open Science Data Repository.'
            ).slice(0, 320);
            const studyType = String(s['Study Assay Technology Type'] || s['Data Source Type'] || 'Spaceflight Physical/Biological Study');
            const organismOrMaterial = String(s['organism'] || s['Material'] || 'Spaceflight Payload');
            const factorSummary = String(s['Study Factor Name'] || 'Microgravity environment');
            const releaseDate = String(s['Study Public Release Date'] || nowIso.slice(0, 10));
            const cleanAcc = accession.replace(/^OSD-?/i, 'OSD-');
            fetchedStudies.push({
              accession,
              title,
              description,
              studyType,
              organismOrMaterial,
              factorSummary,
              releaseDate,
              studyUrl: accession.startsWith('OSD')
                ? `https://osdr.nasa.gov/bio/repo/data/studies/${cleanAcc}`
                : 'https://osdr.nasa.gov/bio/repo/search?q=combustion',
              dataOrigin: 'NASA_OSDR_LIVE',
            });
          }
        } else {
          // Consume minimal body or cancel to release socket cleanly
          await res.body?.cancel();
        }

        const isHealthy = res.ok || (res.status >= 200 && res.status < 400);
        updatedSources.push({
          id: src.id,
          name: src.name,
          url: src.url,
          status: isHealthy ? 'CONNECTED' : 'DEGRADED',
          httpStatus: res.status,
          latencyMs,
          lastCheckedAt: nowIso,
          lastSuccessAt: isHealthy ? nowIso : prev?.lastSuccessAt ?? null,
          notes:
            src.id === 'nasa-osdr' && fetchedStudies.length > 0
              ? `Live API returned ${fetchedStudies.length} matching repository studies.`
              : isHealthy
              ? `HTTP ${res.status} verified in ${latencyMs} ms.`
              : `HTTP ${res.status} response; cached curated records remain active.`,
        });
      } catch (err) {
        const latencyMs = Date.now() - t0;
        const message = err instanceof Error ? err.message : 'Network unreachable';
        updatedSources.push({
          id: src.id,
          name: src.name,
          url: src.url,
          status: 'OFFLINE',
          httpStatus: null,
          latencyMs,
          lastCheckedAt: nowIso,
          lastSuccessAt: prev?.lastSuccessAt ?? null,
          notes: `Connection failed (${message.slice(0, 60)}); operating with verified local archive.`,
        });
      }
    })
  );

  // Sort consistently
  updatedSources.sort((a, b) => a.id.localeCompare(b.id));
  await saveSourceHealth(updatedSources);
  if (fetchedStudies.length > 0) {
    await saveOsdrStudies(fetchedStudies);
  }

  return {
    sources: updatedSources,
    fetchedStudies,
    syncedAt: nowIso,
  };
}

export function parseAndValidateUpload(
  rawText: string,
  format: 'csv' | 'json',
  sourceLabel = 'User Uploaded Scientific Dataset'
): {
  records: CombustionRecord[];
  warnings: string[];
  rejectedCount: number;
} {
  const warnings: string[] = [];
  let rawRows: Record<string, unknown>[] = [];
  let rejectedCount = 0;

  if (format === 'json') {
    const parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON upload must be an array of combustion experiment objects.');
    }
    rawRows = parsed;
  } else {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) {
      throw new Error('CSV upload must contain a header row and at least one data row.');
    }
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < headers.length) {
        rejectedCount++;
        warnings.push(`Row ${i + 1}: column count mismatch (${cols.length} vs ${headers.length}).`);
        continue;
      }
      const rowObj: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx];
      });
      rawRows.push(rowObj);
    }
  }

  const validRecords: CombustionRecord[] = [];
  rawRows.forEach((row, idx) => {
    const num = (keys: string[]): number | null => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '' && row[k] !== null) {
          const val = Number(row[k]);
          if (Number.isFinite(val)) return val;
        }
      }
      return null;
    };
    const str = (keys: string[], fallback: string): string => {
      for (const k of keys) {
        if (row[k] !== undefined && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
      }
      return fallback;
    };

    const oxygenPct = num(['oxygen_pct', 'oxygenpct', 'o2_pct', 'o2']);
    const pressureKpa = num(['pressure_kpa', 'pressurekpa', 'pressure']);
    const airflowCmS = num(['airflow_cm_s', 'airflowcms', 'airflow']) ?? 0;
    const fuelTempK = num(['fuel_temp_k', 'fueltempk', 'temp_k']) ?? 298;
    const gravityG = num(['gravity_g', 'gravityg', 'g']) ?? 0.00001;

    if (oxygenPct === null || oxygenPct < 5 || oxygenPct > 100) {
      rejectedCount++;
      warnings.push(`Row ${idx + 1}: invalid or missing oxygen concentration (% vol).`);
      return;
    }
    if (pressureKpa === null || pressureKpa < 5 || pressureKpa > 500) {
      rejectedCount++;
      warnings.push(`Row ${idx + 1}: invalid or missing pressure (kPa).`);
      return;
    }

    const flameSpreadMmS = num(['flame_spread_mm_s', 'flamespreadmms', 'spread_rate']);
    const ignitionDelayS = num(['ignition_delay_s', 'ignitiondelays']);
    const extinctionO2Pct = num(['extinction_o2_pct', 'extinctiono2pct']);
    const heatReleaseKwM2 = num(['heat_release_kw_m2', 'heatreleasekwm2']);
    const peakFlameTempK = num(['peak_flame_temp_k', 'peakflametempk']);

    const gravityCondition: CombustionRecord['gravityCondition'] =
      gravityG >= 0.8
        ? 'Earth Gravity (1g)'
        : gravityG >= 0.05
        ? 'Partial Gravity (0.16g-0.38g)'
        : 'Microgravity (~0g)';

    const rawOutcome = str(['ignition_outcome', 'ignitionoutcome'], 'Sustained Flame');
    const ignitionOutcome: CombustionRecord['ignitionOutcome'] =
      rawOutcome === 'Cool Flame' ||
      rawOutcome === 'Extinguished' ||
      rawOutcome === 'No Ignition'
        ? rawOutcome
        : 'Sustained Flame';

    const datasetId = str(['dataset_id', 'datasetid'], 'UPLOAD-CUSTOM');
    const experimentName = str(['experiment_name', 'experimentname'], 'Uploaded Experiment');
    const fuelType = str(['fuel_type', 'fueltype'], 'Custom Solid/Liquid Fuel');
    const recordedYear = num(['recorded_year', 'recordedyear']) ?? new Date().getFullYear();

    validRecords.push({
      id: `usr-${Date.now()}-${idx}`,
      datasetId,
      experimentName,
      gravityCondition,
      gravityG,
      fuelType,
      oxygenPct,
      pressureKpa,
      airflowCmS,
      fuelTempK,
      flameSpreadMmS,
      ignitionDelayS,
      extinctionO2Pct,
      heatReleaseKwM2,
      peakFlameTempK,
      experimentalCondition: str(['experimental_condition', 'experimentalcondition'], 'Uploaded experimental run'),
      ignitionOutcome,
      riskLabel: classifyRecordRisk(oxygenPct, airflowCmS, flameSpreadMmS, gravityG),
      dataOrigin: sourceLabel.toLowerCase().includes('offline') ? 'OFFLINE_DEMO_SAMPLE' : 'USER_UPLOADED',
      sourceReference: str(['source_reference', 'sourcereference'], sourceLabel),
      sourceUrl: 'https://osdr.nasa.gov/',
      recordedYear,
    });
  });

  return { records: validRecords, warnings, rejectedCount };
}
