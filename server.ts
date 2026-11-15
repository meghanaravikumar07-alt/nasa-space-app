import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { NASA_INVESTIGATIONS } from './server/data/curatedDatasets.ts';
import {
  getAllCombustionRecords,
  getDb,
  getOsdrStudies,
  getSourceHealth,
  insertCombustionRecords,
} from './server/db/database.ts';
import { analyzeCombustionDataset, predictCombustionRisk } from './server/ml/combustionModel.ts';
import { generateGroundedScientificInsight } from './server/services/geminiInsights.ts';
import { parseAndValidateUpload, syncNasaRepositories } from './server/services/nasaConnector.ts';

const PORT = Number(process.env.PORT || 3000);
const START_TIME = Date.now();
let lastSyncTimestamp: string | null = null;

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Initialize SQLite database on boot
  await getDb();

  // Trigger initial background NASA repository connectivity check (non-blocking)
  syncNasaRepositories()
    .then((res) => {
      lastSyncTimestamp = res.syncedAt;
    })
    .catch(() => {
      // Errors handled internally by syncNasaRepositories
    });

  // Periodic automatic dataset availability check every 15 minutes
  setInterval(() => {
    syncNasaRepositories()
      .then((res) => {
        lastSyncTimestamp = res.syncedAt;
      })
      .catch(() => {});
  }, 15 * 60 * 1000);

  // --- REST API ROUTES ---

  app.get('/api/health', async (_req, res) => {
    try {
      const [records, sources, osdr] = await Promise.all([
        getAllCombustionRecords(),
        getSourceHealth(),
        getOsdrStudies(),
      ]);
      res.json({
        status: 'ONLINE',
        uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
        databaseEngine: 'SQLite (sql.js WASM persisted)',
        recordsCount: records.length,
        osdrStudiesCount: osdr.length,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        lastSyncAt: lastSyncTimestamp,
        sources,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Health check failed' });
    }
  });

  app.get('/api/overview', async (_req, res) => {
    try {
      const [records, sources, osdr] = await Promise.all([
        getAllCombustionRecords(),
        getSourceHealth(),
        getOsdrStudies(),
      ]);

      const spreadValues = records
        .map((r) => r.flameSpreadMmS)
        .filter((v): v is number => v !== null && Number.isFinite(v));
      const avgSpread = spreadValues.length
        ? Number((spreadValues.reduce((a, b) => a + b, 0) / spreadValues.length).toFixed(2))
        : 0;
      const highRiskCount = records.filter((r) => r.riskLabel === 'HIGH RISK').length;
      const microCount = records.filter((r) => r.gravityG < 0.05).length;
      const earthCount = records.filter((r) => r.gravityG >= 0.8).length;
      const uniqueExperiments = new Set(records.map((r) => r.experimentName)).size;

      res.json({
        metrics: {
          experimentsAnalysed: uniqueExperiments,
          availableRecords: records.length,
          avgFlameSpreadMmS: avgSpread,
          detectedHighRiskCount: highRiskCount,
          microgravityRecords: microCount,
          earthComparisonRecords: earthCount,
        },
        investigations: NASA_INVESTIGATIONS,
        sources,
        osdrStudiesCount: osdr.length,
        lastSyncAt: lastSyncTimestamp || sources[0]?.lastCheckedAt || null,
        backendHealth: {
          apiStatus: 'ONLINE',
          databaseEngine: 'SQLite (sql.js persisted)',
          mlEngineStatus: spreadValues.length >= 6 ? 'READY' : 'INSUFFICIENT_DATA',
          geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
          uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Overview query failed' });
    }
  });

  app.get('/api/records', async (req, res) => {
    try {
      const all = await getAllCombustionRecords();
      const dataset = typeof req.query.dataset === 'string' ? req.query.dataset : 'ALL';

      const datasetRecords =
        dataset === 'ALL'
          ? all
          : dataset === 'COMPARATIVE_1G_0G'
          ? all.filter((r) => ['SoFIE', 'SoFIE-GEL', 'Saffire', 'FLEX'].includes(r.experimentName))
          : all.filter(
              (r) => r.experimentName.toLowerCase() === dataset.toLowerCase() || r.datasetId === dataset
            );

      // Compute available facets strictly from the selected dataset
      const availableFacets = {
        experiments: [...new Set(datasetRecords.map((r) => r.experimentName))].sort(),
        gravityConditions: [...new Set(datasetRecords.map((r) => r.gravityCondition))].sort(),
        fuelTypes: [...new Set(datasetRecords.map((r) => r.fuelType))].sort(),
        conditions: [...new Set(datasetRecords.map((r) => r.experimentalCondition))].sort(),
        hasOxygen: datasetRecords.some((r) => Number.isFinite(r.oxygenPct)),
        hasPressure: datasetRecords.some((r) => Number.isFinite(r.pressureKpa)),
        hasAirflow: datasetRecords.some((r) => Number.isFinite(r.airflowCmS)),
        hasFuelTemp: datasetRecords.some((r) => Number.isFinite(r.fuelTempK)),
        hasHeatRelease: datasetRecords.some((r) => r.heatReleaseKwM2 !== null),
        hasExtinction: datasetRecords.some((r) => r.extinctionO2Pct !== null),
        hasIgnitionDelay: datasetRecords.some((r) => r.ignitionDelayS !== null),
      };

      res.json({
        records: datasetRecords,
        totalDatasetCount: all.length,
        availableFacets,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Records query failed' });
    }
  });

  app.post('/api/data/sync', async (_req, res) => {
    try {
      const result = await syncNasaRepositories();
      lastSyncTimestamp = result.syncedAt;
      const osdrStudies = await getOsdrStudies();
      res.json({
        syncedAt: result.syncedAt,
        sources: result.sources,
        fetchedStudiesCount: result.fetchedStudies.length,
        osdrStudies,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'NASA sync failed' });
    }
  });

  app.post('/api/data/upload', async (req, res) => {
    try {
      const { rawText, format, sourceLabel } = req.body as {
        rawText?: string;
        format?: 'csv' | 'json';
        sourceLabel?: string;
      };

      if (!rawText || (format !== 'csv' && format !== 'json')) {
        res.status(400).json({ error: 'Provide rawText and format ("csv" or "json").' });
        return;
      }

      const parsed = parseAndValidateUpload(rawText, format, sourceLabel);
      if (parsed.records.length === 0) {
        res.status(422).json({
          error: 'No valid combustion records could be extracted.',
          warnings: parsed.warnings,
        });
        return;
      }

      const inserted = await insertCombustionRecords(parsed.records);
      res.json({
        insertedCount: inserted,
        rejectedCount: parsed.rejectedCount,
        warnings: parsed.warnings,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Dataset upload failed' });
    }
  });

  app.get('/api/sample-csv', (_req, res) => {
    const samplePath = path.join(process.cwd(), 'data', 'sample_combustion_dataset.csv');
    if (!fs.existsSync(samplePath)) {
      res.status(404).json({ error: 'Sample CSV not found' });
      return;
    }
    res.type('text/csv').send(fs.readFileSync(samplePath, 'utf-8'));
  });

  app.get('/api/ml/analysis', async (_req, res) => {
    try {
      const records = await getAllCombustionRecords();
      const analysis = analyzeCombustionDataset(records);
      res.json(analysis);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'ML analysis failed' });
    }
  });

  app.post('/api/ml/predict', async (req, res) => {
    try {
      const body = req.body as {
        oxygenPct?: number;
        pressureKpa?: number;
        airflowCmS?: number;
        fuelTempK?: number;
        gravityG?: number;
        fuelType?: string;
      };

      const inputs = {
        oxygenPct: Number(body.oxygenPct ?? 21.0),
        pressureKpa: Number(body.pressureKpa ?? 101.3),
        airflowCmS: Number(body.airflowCmS ?? 10.0),
        fuelTempK: Number(body.fuelTempK ?? 350),
        gravityG: Number(body.gravityG ?? 0.00001),
        fuelType: String(body.fuelType || 'Cast PMMA'),
      };

      const records = await getAllCombustionRecords();
      const prediction = predictCombustionRisk(records, inputs);
      res.json(prediction);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Risk prediction failed' });
    }
  });

  app.post('/api/ai/synthesize', async (req, res) => {
    try {
      const { question, focusExperiment } = req.body as {
        question?: string;
        focusExperiment?: string;
      };
      if (!question || question.trim().length < 3) {
        res.status(400).json({ error: 'Please provide a scientific analysis question.' });
        return;
      }
      const records = await getAllCombustionRecords();
      const scoped =
        focusExperiment && focusExperiment !== 'ALL'
          ? records.filter((r) => r.experimentName === focusExperiment)
          : records;
      const analysis = analyzeCombustionDataset(scoped.length >= 6 ? scoped : records);
      const synthesis = await generateGroundedScientificInsight(
        question.trim(),
        analysis,
        focusExperiment
      );
      res.json(synthesis);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI synthesis failed' });
    }
  });

  app.get('/api/research/investigations', async (_req, res) => {
    try {
      const osdrStudies = await getOsdrStudies();
      res.json({
        investigations: NASA_INVESTIGATIONS,
        osdrStudies,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Research lookup failed' });
    }
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ORBITAL X server active on http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
