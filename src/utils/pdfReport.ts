import { jsPDF } from 'jspdf';
import type { MlAnalysisResponse, RiskPredictionResult } from '../types/combustion.ts';

export function exportCombustionPdfReport(options: {
  prediction?: RiskPredictionResult | null;
  analysis?: MlAnalysisResponse | null;
  selectedExperiment?: string;
  datasetCount?: number;
}) {
  const { prediction, analysis, selectedExperiment = 'All Loaded Investigations', datasetCount = 0 } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  const addLine = (text: string, size = 10, color: [number, number, number] = [30, 41, 59], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, pageWidth - 28);
    if (y + lines.length * (size * 0.45) > 276) {
      doc.addPage();
      y = 18;
    }
    doc.text(lines, 14, y);
    y += lines.length * (size * 0.44) + 2.5;
  };

  // Header Banner
  doc.setFillColor(5, 11, 24);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(248, 250, 252);
  doc.text('ORBITAL X — AEROSPACE COMBUSTION INTELLIGENCE REPORT', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 217, 255);
  doc.text('Understanding Fire Beyond Gravity. Protecting Life Beyond Earth.', 14, 22);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toISOString()}   |   Scope: ${selectedExperiment}`, 14, 28);

  y = 42;
  addLine('1. EXECUTIVE DATASET & EXPERIMENT SUMMARY', 12, [15, 23, 42], true);
  addLine(
    `Selected Experiment Scope: ${selectedExperiment} | Total Active Database Records: ${datasetCount} | ` +
      `ML Evaluation Sample Size: ${analysis?.sampleCount ?? 'N/A'}`,
    9.5
  );

  if (analysis) {
    addLine(
      `Model Architecture: ${analysis.modelType} | Holdout Test R²: ${analysis.metrics.testR2} | ` +
        `5-Fold CV R²: ${analysis.metrics.cvR2} | Test RMSE: ${analysis.metrics.rmseMmS} mm/s | MAE: ${analysis.metrics.maeMmS} mm/s`,
      9.5
    );
    addLine(
      `Gravity Comparison: Microgravity (~0g) mean spread ${analysis.gravityComparison.avgSpreadMicrogravityMmS} mm/s ` +
        `(n=${analysis.gravityComparison.microgravityCount}) vs Earth 1g mean spread ${analysis.gravityComparison.avgSpreadEarthMmS} mm/s ` +
        `(n=${analysis.gravityComparison.earthGravityCount}).`,
      9.5
    );
  }

  y += 2;
  if (prediction) {
    addLine('2. ENVIRONMENTAL PARAMETERS & RISK CLASSIFICATION', 12, [15, 23, 42], true);
    addLine(
      `Fuel Material: ${prediction.inputs.fuelType} | Gravity: ${
        prediction.inputs.gravityG < 0.01 ? 'Microgravity (~0g)' : `${prediction.inputs.gravityG}g`
      } | Oxygen: ${prediction.inputs.oxygenPct}% vol | Pressure: ${prediction.inputs.pressureKpa} kPa | ` +
        `Forced Airflow: ${prediction.inputs.airflowCmS} cm/s | Fuel Temp: ${prediction.inputs.fuelTempK} K`,
      9.5
    );
    addLine(
      `Estimated Risk Category: ${prediction.riskLevel} (Prototype Index: ${prediction.compositeRiskIndex}/100)`,
      11,
      prediction.riskLevel === 'HIGH RISK'
        ? [185, 28, 28]
        : prediction.riskLevel === 'ELEVATED RISK'
        ? [180, 83, 9]
        : [37, 99, 235],
      true
    );
    addLine(
      `Predicted Flame Spread Rate: ${prediction.predictedFlameSpreadMmS} mm/s ` +
        `(95% Statistical Bound: ${prediction.confidenceIntervalMmS[0]} – ${prediction.confidenceIntervalMmS[1]} mm/s)`,
      10
    );

    y += 2;
    addLine('3. KEY CONTRIBUTING VARIABLES', 12, [15, 23, 42], true);
    prediction.contributingVariables.forEach((v) => {
      addLine(`• ${v.variable} (${v.valueFormatted}) [${v.impact} Impact]: ${v.rationale}`, 9.5);
    });

    y += 2;
    addLine('4. RECOMMENDED AREAS FOR FURTHER INVESTIGATION', 12, [15, 23, 42], true);
    prediction.recommendedInvestigations.forEach((rec) => {
      addLine(`• ${rec}`, 9.5);
    });
  }

  if (analysis && analysis.insights.length > 0) {
    y += 2;
    addLine('5. AI-GENERATED SCIENTIFIC INSIGHTS (DATA-GROUNDED)', 12, [15, 23, 42], true);
    analysis.insights.forEach((ins) => {
      addLine(`[${ins.category}] ${ins.title} — ${ins.finding} (${ins.evidenceMetric})`, 9);
    });
  }

  y += 2;
  addLine('6. MODEL LIMITATIONS & SCIENTIFIC DISCLAIMER', 12, [15, 23, 42], true);
  const limitations = prediction?.modelLimitations ?? analysis?.limitations ?? [];
  limitations.forEach((lim) => addLine(`• ${lim}`, 9));
  addLine(
    prediction?.disclaimer ??
      analysis?.disclaimer ??
      'EXPERIMENTAL RESEARCH PROTOTYPE: Not a NASA-certified fire safety assessment.',
    9,
    [153, 27, 27],
    true
  );

  y += 2;
  addLine('7. DATA SOURCE REFERENCES', 12, [15, 23, 42], true);
  addLine('• NASA Physical Sciences Informatics (PSI): https://psi.nasa.gov/', 8.5);
  addLine('• NASA Open Science Data Repository (OSDR): https://osdr.nasa.gov/', 8.5);
  addLine('• NASA FLEX Investigation (PSI-69): https://psi.nasa.gov/physci/repo/data/investigations/PSI-69', 8.5);
  addLine('• NASA Saffire Investigation (PSI-98): https://psi.nasa.gov/physci/repo/data/investigations/PSI-98', 8.5);
  addLine('• NASA SoFIE Investigation: https://science.nasa.gov/biological-physical/investigations/sofie/', 8.5);

  doc.save(`orbital-x-combustion-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
