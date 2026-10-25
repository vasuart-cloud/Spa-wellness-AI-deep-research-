import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AIResponseContract,
  AuditEvent,
  InterventionRecord,
  OutboxMessage,
  PersonaId,
  RevenueOpportunity,
} from "../types/domain";
import {
  computeIllustrativeValueScenarios,
  formatCurrency,
  formatPct,
  formatSignedPct,
  formatSignedPts,
  getRegionalSummaries,
  getSalonComparisons,
  getScopeAggregateKPIs,
} from "./analyticsService";
import { getSourceSystems, PERSONAS, SALONS } from "./syntheticDataService";

export function downloadTableAsCsv(
  filename: string,
  columns: Array<{ key: string; header: string }>,
  rows: Array<Record<string, string | number>>
): void {
  const headerLine = columns
    .map((c) => `"${c.header.replace(/"/g, '""')}"`)
    .join(",");
  const bodyLines = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  const csvContent = [headerLine, ...bodyLines].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportInsightReportPdf(response: AIResponseContract): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 40;
  const pageMaxY = 770;
  let y = 44;

  const ensureSpace = (neededPt: number) => {
    if (y + neededPt > pageMaxY) {
      doc.addPage();
      y = 48;
    }
  };

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 76, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("InsightFlow — Certified Analytical Insight Report", margin, 32);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Elevate Salon & Wellness Group · Concept Prototype (Synthetic Data) · Scope: ${response.businessScope}`,
    margin,
    50
  );
  doc.text(
    `Timeframe: ${response.timeRange} · Source: ${response.sourceFreshness.name} (${response.sourceFreshness.status})`,
    margin,
    64
  );

  y = 98;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(response.title, 515);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 16 + 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  const summaryLines = doc.splitTextToSize(response.summary, 515);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 14 + 12;

  if (response.kpis.length > 0) {
    ensureSpace(90);
    autoTable(doc, {
      startY: y,
      head: [["KPI Metric", "Current Value", "Baseline", "Variance"]],
      body: response.kpis.map((k) => [
        k.label,
        k.currentValue,
        `${k.baselineValue} (${k.baselineLabel})`,
        k.varianceLabel,
      ]),
      theme: "grid",
      headStyles: { fillColor: [13, 148, 136], fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 5 },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  if (response.tableRows.length > 0 && response.tableColumns.length > 0) {
    ensureSpace(110);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Supporting Salon & Regional Evidence", margin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [response.tableColumns.map((c) => c.header)],
      body: response.tableRows
        .slice(0, 20)
        .map((r) => response.tableColumns.map((c) => String(r[c.key] ?? ""))),
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 4.5 },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  if (response.interpretation || response.likelyDrivers.length > 0) {
    const interpLines = doc.splitTextToSize(
      `Operational Interpretation: ${response.interpretation}`,
      515
    );
    ensureSpace(interpLines.length * 13 + response.likelyDrivers.length * 14 + 24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Evidence-Based Drivers & Interpretation", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(interpLines, margin, y);
    y += interpLines.length * 12.5 + 6;
    response.likelyDrivers.forEach((drv) => {
      const drvLines = doc.splitTextToSize(`• ${drv}`, 505);
      ensureSpace(drvLines.length * 12 + 4);
      doc.text(drvLines, margin + 6, y);
      y += drvLines.length * 12 + 3;
    });
    y += 10;
  }

  if (response.recommendedActions.length > 0) {
    ensureSpace(100);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Recommended Actions & Required Human Approvals", margin, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["Priority", "Action", "Expected Impact", "Approval Gate"]],
      body: response.recommendedActions.map((a) => [
        a.priority,
        a.title,
        a.expectedImpactDirection,
        a.requiredHumanApproval,
      ]),
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 4.5 },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  const foot = `Data Freshness: ${response.sourceFreshness.name} through ${response.sourceFreshness.dataThroughTimestamp} (Age: ${response.sourceFreshness.ageHours}h · ${response.sourceFreshness.updateScheduleLabel}). Formula: ${response.calculationDetails.formulaSummary}`;
  const footLines = doc.splitTextToSize(foot, 515);
  ensureSpace(footLines.length * 11 + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(footLines, margin, y + 4);

  doc.save(`InsightFlow_Report_${response.topicKey}.pdf`);
}

export function exportExecutiveBriefPdf(params: {
  dataVersion: number;
  demoTimeOffsetHours?: number;
  posSyncRefreshed: boolean;
  opportunities: RevenueOpportunity[];
  interventions?: InterventionRecord[];
  personaId?: PersonaId;
}): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 40;
  const pageMaxY = 770;
  const actor = PERSONAS[params.personaId ?? "meera"];
  const isAllRegions = actor.canViewAllRegions;

  const ensureSpace = (currentY: number, neededPt: number): number => {
    if (currentY + neededPt > pageMaxY) {
      doc.addPage();
      return 48;
    }
    return currentY;
  };

  const scopedIds = isAllRegions
    ? SALONS.map((s) => s.id)
    : actor.allowedSalonIds;
  const agg = getScopeAggregateKPIs(scopedIds, params.dataVersion);
  const sources = getSourceSystems(
    params.demoTimeOffsetHours ?? 0,
    params.posSyncRefreshed
  );

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 82, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15.5);
  doc.text(
    isAllRegions
      ? "COO Executive Brief — Elevate Salon & Wellness Group"
      : `Regional Operations Brief — ${actor.assignedRegion}`,
    margin,
    34
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    isAllRegions
      ? `Prepared for ${actor.name} (${actor.roleTitle}) · All 20 Salons Across 4 Regions`
      : `Prepared for ${actor.name} (${actor.roleTitle}) · Scoped to ${scopedIds.length} Authorized Salons`,
    margin,
    52
  );
  doc.text(
    `InsightFlow Concept Prototype (Synthetic Data) · Warehouse Close: ${sources["SRC-WAREHOUSE-DAILY"].dataThroughTimestamp}`,
    margin,
    67
  );

  let y = 104;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(
    isAllRegions ? "1. Executive Summary" : "1. Regional Operational Summary",
    margin,
    y
  );
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  const execText = isAllRegions
    ? `Organization 30-day net revenue stands at ${formatCurrency(agg.totalRevenue)} (${formatSignedPct(agg.revGrowthMoMPct)} MoM) with ${formatCurrency(agg.contributionDollars)} estimated contribution (${formatPct(agg.contributionMarginPct)} margin) across ${agg.completedVisits.toLocaleString()} completed visits. Near-term management attention is concentrated on recovering declining repeat visits & Mon–Wed utilization in Pacific Northwest, and halting unapproved promotional discount stacking (17.1%) compressing contribution margin at Scottsdale Kierland Retreat.`
    : `${actor.assignedRegion} 30-day net revenue across ${scopedIds.length} authorized studios stands at ${formatCurrency(agg.totalRevenue)} (${formatSignedPct(agg.revGrowthMoMPct)} MoM) with ${formatCurrency(agg.contributionDollars)} estimated contribution (${formatPct(agg.contributionMarginPct)} margin) and ${agg.completedVisits.toLocaleString()} completed visits. Regional repeat-visit rate is ${formatPct(agg.avgRepeatRate)} (${formatSignedPts(agg.repeatDeltaPts)} vs 3-month baseline) with ${agg.unusedHours.toLocaleString()} unused stylist hours (${formatPct(agg.utilizationPct)} utilization).`;

  const lines = doc.splitTextToSize(execText, 515);
  doc.text(lines, margin, y);
  y += lines.length * 13 + 14;

  y = ensureSpace(y, 120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);

  if (isAllRegions) {
    const regions = getRegionalSummaries(scopedIds, params.dataVersion);
    doc.text("2. Regional Performance Matrix", margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [
        [
          "Region",
          "Salons",
          "Net Revenue",
          "MoM %",
          "Contrib. Margin",
          "Repeat %",
          "Utilization",
          "Rev at Risk",
        ],
      ],
      body: regions.map((r) => [
        r.region,
        String(r.salonCount),
        formatCurrency(r.totalRevenue),
        formatSignedPct(r.revenueGrowthPct),
        formatPct(r.avgContributionMarginPct),
        formatPct(r.avgRepeatVisitRate),
        formatPct(r.avgStaffUtilizationPct),
        formatCurrency(r.revenueAtRiskDollars),
      ]),
      theme: "grid",
      headStyles: { fillColor: [13, 148, 136], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 4.5 },
      margin: { left: margin, right: margin },
    });
  } else {
    const comps = getSalonComparisons(scopedIds, params.dataVersion);
    doc.text("2. Authorized Salon Performance Matrix (Pacific Northwest)", margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [
        [
          "Salon",
          "Net Revenue",
          "vs Target",
          "Contrib. Margin",
          "Repeat %",
          "Rebook %",
          "Utilization",
        ],
      ],
      body: comps.map((c) => [
        c.salon.name,
        formatCurrency(c.current.totalRevenue),
        formatCurrency(c.targetVarianceDollars),
        formatPct(c.current.contributionMarginPct),
        formatPct(c.current.repeatVisitRate),
        formatPct(c.current.rebookingRate),
        formatPct(c.current.staffUtilizationPct),
      ]),
      theme: "grid",
      headStyles: { fillColor: [13, 148, 136], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 4.5 },
      margin: { left: margin, right: margin },
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 18;

  const scopedOpportunities = isAllRegions
    ? params.opportunities
    : params.opportunities.filter((o) =>
        o.affectedSalonIds.some((id) => scopedIds.includes(id))
      );

  y = ensureSpace(y, 120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(
    isAllRegions
      ? "3. Top Business Risks & Recommended Executive Actions"
      : "3. Scoped Regional Opportunities & Action Status",
    margin,
    y
  );
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Risk Category", "Scope", "Est. Monthly Impact", "Priority Action", "Status"]],
    body: scopedOpportunities.slice(0, 6).map((o) => [
      o.category,
      isAllRegions ? o.region : actor.assignedRegion,
      formatCurrency(o.monthlyImpactDollars),
      o.recommendedAction,
      o.status,
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
    styles: { fontSize: 7.8, cellPadding: 4.5 },
    margin: { left: margin, right: margin },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 18;

  const scopedInterventions = (params.interventions ?? []).filter((iv) =>
    isAllRegions
      ? true
      : iv.affectedSalonIds.some((id) => scopedIds.includes(id))
  );
  if (scopedInterventions.length > 0) {
    y = ensureSpace(y, 110);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text("4. Recorded Management Interventions & Holdout Outcomes", margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [
        [
          "Intervention",
          "Status",
          "Before -> After",
          "Est. Net Contrib / Mo",
        ],
      ],
      body: scopedInterventions.slice(0, 5).map((iv) => [
        iv.title,
        iv.status,
        `${iv.beforeMetricLabel} -> ${iv.afterMetricLabel}`,
        formatCurrency(iv.estimatedNetContributionMonthly),
      ]),
      theme: "grid",
      headStyles: { fillColor: [13, 148, 136], fontSize: 8 },
      styles: { fontSize: 7.8, cellPadding: 4.5 },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  if (isAllRegions) {
    const sensitivity = computeIllustrativeValueScenarios();
    y = ensureSpace(y, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(
      "5. Financial Assumptions & Illustrative Annual Sensitivity (Not a Forecast)",
      margin,
      y
    );
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Relative Visit Uplift",
          "Annual Baseline Visits",
          "Incremental Visits",
          "Additional Sales ($95 Ticket)",
          "Addl. Contribution (35%)",
        ],
      ],
      body: sensitivity.map((s) => [
        `${s.upliftPct.toFixed(2)}% (Illustrative)`,
        s.annualBaselineVisits.toLocaleString(),
        s.incrementalCompletedVisits.toLocaleString(),
        formatCurrency(s.additionalAnnualSalesDollars),
        formatCurrency(s.additionalAnnualContributionDollars),
      ]),
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 4.5 },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 16;
  }

  const freshnessNote = `Data Freshness Caveat: Financial KPIs are daily batch (04:00 AM local, age ${sources["SRC-WAREHOUSE-DAILY"].ageHours}h); Booking stream ~25m lag; POS Retail SKU Sync status: ${sources["SRC-POS-RETAIL"].status} (${sources["SRC-POS-RETAIL"].ageHours}h old). Improved insights require manager action and holdout validation to realize financial uplift.`;
  const noteLines = doc.splitTextToSize(freshnessNote, 515);
  y = ensureSpace(y, noteLines.length * 11 + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139);
  doc.text(noteLines, margin, y + 4);

  doc.save(
    isAllRegions
      ? "Elevate_COO_Executive_Brief_Oct2026.pdf"
      : "Elevate_PNW_Regional_Brief_Oct2026.pdf"
  );
}

export function exportAuditReportPdf(events: AuditEvent[], actorPersona: PersonaId): boolean {
  if (!PERSONAS[actorPersona].canExportAudit) {
    return false;
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 40;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("InsightFlow — Tenant Governance & Audit Log Export", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Authorized Export by ${PERSONAS[actorPersona].name} · Append-Only Prototype Event Records`,
    margin,
    50
  );

  autoTable(doc, {
    startY: 88,
    head: [["Timestamp", "Actor", "Category", "Outcome", "Scope", "Summary"]],
    body: events.slice(0, 35).map((e) => [
      e.timestamp,
      e.actorName,
      e.category,
      e.outcome,
      e.scopeLabel,
      e.summary,
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 4 },
    margin: { left: margin, right: margin },
  });

  doc.save("InsightFlow_Tenant_Audit_Report.pdf");
  return true;
}

export function createSimulatedShareDelivery(params: {
  senderPersona: PersonaId;
  channel: "Email" | "WhatsApp" | "SMS";
  recipient: string;
  subject: string;
  bodyPreview: string;
  reportType: string;
}): OutboxMessage {
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 3600 * 1000);
  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  const scopeSlug =
    params.senderPersona === "arjun"
      ? "pnw-regional"
      : params.senderPersona === "meera"
        ? "org-executive"
        : "tenant-governance";
  return {
    id: `OUT-${Date.now()}`,
    timestamp: now.toISOString().replace("T", " ").slice(0, 19) + " UTC",
    senderPersona: params.senderPersona,
    channel: params.channel,
    recipient: params.recipient,
    subject: params.subject,
    bodyPreview: params.bodyPreview,
    secureLinkUrl: `https://insightflow.elevate-demo.local/r/${token}?scope=${scopeSlug}&exp=24h`,
    linkExpiresAt: expires.toISOString().replace("T", " ").slice(0, 16) + " UTC",
    reportType: params.reportType,
    deliveryBanner: "Demo delivery — not actually sent (Recorded in Simulated Outbox & Audit Log)",
  };
}
