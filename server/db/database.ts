import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import type {
  CombustionRecord,
  DataOrigin,
  OsdrStudyMetadata,
  RiskLevel,
  SourceHealthStatus,
} from '../../src/types/combustion.ts';
import { CURATED_COMBUSTION_RECORDS, FALLBACK_OSDR_STUDIES } from '../data/curatedDatasets.ts';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'orbitalx.sqlite');

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

function persistDatabase(db: Database) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const binary = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(binary));
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
    });

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let db: Database;
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS combustion_records (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        experiment_name TEXT NOT NULL,
        gravity_condition TEXT NOT NULL,
        gravity_g REAL NOT NULL,
        fuel_type TEXT NOT NULL,
        oxygen_pct REAL NOT NULL,
        pressure_kpa REAL NOT NULL,
        airflow_cm_s REAL NOT NULL,
        fuel_temp_k REAL NOT NULL,
        flame_spread_mm_s REAL,
        ignition_delay_s REAL,
        extinction_o2_pct REAL,
        heat_release_kw_m2 REAL,
        peak_flame_temp_k REAL,
        experimental_condition TEXT NOT NULL,
        ignition_outcome TEXT NOT NULL,
        risk_label TEXT NOT NULL,
        data_origin TEXT NOT NULL,
        source_reference TEXT NOT NULL,
        source_url TEXT NOT NULL,
        recorded_year INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS osdr_studies (
        accession TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        study_type TEXT NOT NULL,
        organism_or_material TEXT NOT NULL,
        factor_summary TEXT NOT NULL,
        release_date TEXT NOT NULL,
        study_url TEXT NOT NULL,
        data_origin TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS source_health (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL,
        http_status INTEGER,
        latency_ms INTEGER,
        last_checked_at TEXT NOT NULL,
        last_success_at TEXT,
        notes TEXT NOT NULL
      );
    `);

    // Seed curated NASA combustion records if empty
    const countRes = db.exec('SELECT COUNT(*) AS cnt FROM combustion_records');
    const existingCount = Number(countRes[0]?.values[0]?.[0] ?? 0);
    if (existingCount === 0) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO combustion_records (
          id, dataset_id, experiment_name, gravity_condition, gravity_g, fuel_type,
          oxygen_pct, pressure_kpa, airflow_cm_s, fuel_temp_k, flame_spread_mm_s,
          ignition_delay_s, extinction_o2_pct, heat_release_kw_m2, peak_flame_temp_k,
          experimental_condition, ignition_outcome, risk_label, data_origin,
          source_reference, source_url, recorded_year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of CURATED_COMBUSTION_RECORDS) {
        stmt.run([
          r.id,
          r.datasetId,
          r.experimentName,
          r.gravityCondition,
          r.gravityG,
          r.fuelType,
          r.oxygenPct,
          r.pressureKpa,
          r.airflowCmS,
          r.fuelTempK,
          r.flameSpreadMmS,
          r.ignitionDelayS,
          r.extinctionO2Pct,
          r.heatReleaseKwM2,
          r.peakFlameTempK,
          r.experimentalCondition,
          r.ignitionOutcome,
          r.riskLabel,
          r.dataOrigin,
          r.sourceReference,
          r.sourceUrl,
          r.recordedYear,
        ]);
      }
      stmt.free();
    }

    // Seed fallback OSDR studies if empty
    const osdrCountRes = db.exec('SELECT COUNT(*) AS cnt FROM osdr_studies');
    const osdrCount = Number(osdrCountRes[0]?.values[0]?.[0] ?? 0);
    if (osdrCount === 0) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO osdr_studies (
          accession, title, description, study_type, organism_or_material,
          factor_summary, release_date, study_url, data_origin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of FALLBACK_OSDR_STUDIES) {
        stmt.run([
          s.accession,
          s.title,
          s.description,
          s.studyType,
          s.organismOrMaterial,
          s.factorSummary,
          s.releaseDate,
          s.studyUrl,
          s.dataOrigin,
        ]);
      }
      stmt.free();
    }

    persistDatabase(db);
    dbInstance = db;
    return db;
  })();

  return initPromise;
}

export async function getAllCombustionRecords(): Promise<CombustionRecord[]> {
  const db = await getDb();
  const res = db.exec('SELECT * FROM combustion_records ORDER BY recorded_year DESC, id ASC');
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, idx) => {
      obj[c] = row[idx];
    });
    return {
      id: String(obj.id),
      datasetId: String(obj.dataset_id),
      experimentName: String(obj.experiment_name),
      gravityCondition: obj.gravity_condition as CombustionRecord['gravityCondition'],
      gravityG: Number(obj.gravity_g),
      fuelType: String(obj.fuel_type),
      oxygenPct: Number(obj.oxygen_pct),
      pressureKpa: Number(obj.pressure_kpa),
      airflowCmS: Number(obj.airflow_cm_s),
      fuelTempK: Number(obj.fuel_temp_k),
      flameSpreadMmS: obj.flame_spread_mm_s !== null ? Number(obj.flame_spread_mm_s) : null,
      ignitionDelayS: obj.ignition_delay_s !== null ? Number(obj.ignition_delay_s) : null,
      extinctionO2Pct: obj.extinction_o2_pct !== null ? Number(obj.extinction_o2_pct) : null,
      heatReleaseKwM2: obj.heat_release_kw_m2 !== null ? Number(obj.heat_release_kw_m2) : null,
      peakFlameTempK: obj.peak_flame_temp_k !== null ? Number(obj.peak_flame_temp_k) : null,
      experimentalCondition: String(obj.experimental_condition),
      ignitionOutcome: obj.ignition_outcome as CombustionRecord['ignitionOutcome'],
      riskLabel: obj.risk_label as RiskLevel,
      dataOrigin: obj.data_origin as DataOrigin,
      sourceReference: String(obj.source_reference),
      sourceUrl: String(obj.source_url),
      recordedYear: Number(obj.recorded_year),
    };
  });
}

export async function insertCombustionRecords(records: CombustionRecord[]): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO combustion_records (
      id, dataset_id, experiment_name, gravity_condition, gravity_g, fuel_type,
      oxygen_pct, pressure_kpa, airflow_cm_s, fuel_temp_k, flame_spread_mm_s,
      ignition_delay_s, extinction_o2_pct, heat_release_kw_m2, peak_flame_temp_k,
      experimental_condition, ignition_outcome, risk_label, data_origin,
      source_reference, source_url, recorded_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of records) {
    stmt.run([
      r.id,
      r.datasetId,
      r.experimentName,
      r.gravityCondition,
      r.gravityG,
      r.fuelType,
      r.oxygenPct,
      r.pressureKpa,
      r.airflowCmS,
      r.fuelTempK,
      r.flameSpreadMmS,
      r.ignitionDelayS,
      r.extinctionO2Pct,
      r.heatReleaseKwM2,
      r.peakFlameTempK,
      r.experimentalCondition,
      r.ignitionOutcome,
      r.riskLabel,
      r.dataOrigin,
      r.sourceReference,
      r.sourceUrl,
      r.recordedYear,
    ]);
  }
  stmt.free();
  persistDatabase(db);
  return records.length;
}

export async function saveOsdrStudies(studies: OsdrStudyMetadata[]): Promise<void> {
  if (!studies.length) return;
  const db = await getDb();
  // Remove offline sample rows if real live OSDR studies arrived
  const hasLive = studies.some((s) => s.dataOrigin === 'NASA_OSDR_LIVE');
  if (hasLive) {
    db.run(`DELETE FROM osdr_studies WHERE data_origin = 'OFFLINE_DEMO_SAMPLE'`);
  }
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO osdr_studies (
      accession, title, description, study_type, organism_or_material,
      factor_summary, release_date, study_url, data_origin
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of studies) {
    stmt.run([
      s.accession,
      s.title,
      s.description,
      s.studyType,
      s.organismOrMaterial,
      s.factorSummary,
      s.releaseDate,
      s.studyUrl,
      s.dataOrigin,
    ]);
  }
  stmt.free();
  persistDatabase(db);
}

export async function getOsdrStudies(): Promise<OsdrStudyMetadata[]> {
  const db = await getDb();
  const res = db.exec('SELECT * FROM osdr_studies ORDER BY release_date DESC, accession ASC');
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, idx) => {
      obj[c] = row[idx];
    });
    return {
      accession: String(obj.accession),
      title: String(obj.title),
      description: String(obj.description),
      studyType: String(obj.study_type),
      organismOrMaterial: String(obj.organism_or_material),
      factorSummary: String(obj.factor_summary),
      releaseDate: String(obj.release_date),
      studyUrl: String(obj.study_url),
      dataOrigin: obj.data_origin as OsdrStudyMetadata['dataOrigin'],
    };
  });
}

export async function saveSourceHealth(statuses: SourceHealthStatus[]): Promise<void> {
  const db = await getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO source_health (
      id, name, url, status, http_status, latency_ms, last_checked_at, last_success_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of statuses) {
    stmt.run([
      s.id,
      s.name,
      s.url,
      s.status,
      s.httpStatus,
      s.latencyMs,
      s.lastCheckedAt,
      s.lastSuccessAt,
      s.notes,
    ]);
  }
  stmt.free();
  persistDatabase(db);
}

export async function getSourceHealth(): Promise<SourceHealthStatus[]> {
  const db = await getDb();
  const res = db.exec('SELECT * FROM source_health ORDER BY id ASC');
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, idx) => {
      obj[c] = row[idx];
    });
    return {
      id: String(obj.id),
      name: String(obj.name),
      url: String(obj.url),
      status: obj.status as SourceHealthStatus['status'],
      httpStatus: obj.http_status !== null ? Number(obj.http_status) : null,
      latencyMs: obj.latency_ms !== null ? Number(obj.latency_ms) : null,
      lastCheckedAt: String(obj.last_checked_at),
      lastSuccessAt: obj.last_success_at ? String(obj.last_success_at) : null,
      notes: String(obj.notes),
    };
  });
}
