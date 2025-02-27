import { Result as LighthouseResult } from "lighthouse";
import { AuditCategory, LighthouseReport } from "./types.js";
import { runLighthouseAudit } from "./index.js";

interface PerformanceAudit {
  id: string; // e.g., "first-contentful-paint"
  title: string; // e.g., "First Contentful Paint"
  description: string; // e.g., "Time to first contentful paint..."
  score: number | null; // 0-1 or null
  scoreDisplayMode: string; // e.g., "numeric"
  numericValue?: number; // e.g., 1.8 (seconds) or 200 (ms)
  numericUnit?: string; // e.g., "s" or "ms"
  details?: PerformanceAuditDetails; // Optional, structured details
  weight?: number; // For prioritization
}

interface PerformanceAuditDetails {
  items?: Array<{
    resourceUrl?: string; // e.g., "https://example.com/script.js" (for render-blocking resources)
    wastedMs?: number; // e.g., 150 (potential savings)
    elementSelector?: string; // e.g., "img.hero" (for LCP element)
    timing?: number; // e.g., 2.5 (specific timing value)
  }>;
  type?: string; // e.g., "opportunity" or "table"
}

const FAILED_AUDITS_LIMIT = 5;
const MAX_ITEMS_IN_DETAILS = 3;

export async function runPerformanceAudit(
  url: string
): Promise<LighthouseReport> {
  try {
    const lhr = await runLighthouseAudit(url, [AuditCategory.PERFORMANCE]);
    return extractPerformanceResult(lhr, url);
  } catch (error) {
    throw new Error(
      `Performance audit failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

const extractPerformanceResult = (
  lhr: LighthouseResult,
  url: string
): LighthouseReport => {
  const categoryData = lhr.categories[AuditCategory.PERFORMANCE];
  const metadata = {
    url,
    timestamp: lhr.fetchTime
      ? new Date(lhr.fetchTime).toISOString()
      : new Date().toISOString(),
    device: "desktop", // TODO: pass device from the request instead of hardcoding
    lighthouseVersion: lhr.lighthouseVersion,
  };

  if (!categoryData) {
    return {
      metadata,
      failedAudits: [],
      overallScore: 0,
      failedAuditsCount: 0,
      passedAuditsCount: 0,
      manualAuditsCount: 0,
      informativeAuditsCount: 0,
      notApplicableAuditsCount: 0,
    };
  }

  const overallScore = Math.round((categoryData.score || 0) * 100);
  const auditRefs = categoryData.auditRefs || [];
  const audits = lhr.audits || {};

  const performanceAudits: PerformanceAudit[] = auditRefs.map((ref) => {
    const audit = audits[ref.id];
    let simplifiedDetails: PerformanceAuditDetails | undefined;

    if (audit.details) {
      simplifiedDetails = {};
      if (
        (audit.details as any).items &&
        Array.isArray((audit.details as any).items)
      ) {
        const limitedItems = (audit.details as any).items.slice(
          0,
          MAX_ITEMS_IN_DETAILS
        );
        simplifiedDetails.items = limitedItems.map((item: any) => {
          const simplifiedItem: any = {};
          if (item.url) simplifiedItem.resourceUrl = item.url; // For render-blocking resources
          if (item.wastedMs) simplifiedItem.wastedMs = item.wastedMs; // Potential savings
          if (item.node?.selector)
            simplifiedItem.elementSelector = item.node.selector; // For LCP element
          if (item.timing) simplifiedItem.timing = item.timing; // Specific timing
          return simplifiedItem;
        });
      }
      if (audit.details.type) simplifiedDetails.type = audit.details.type;
    }

    return {
      id: ref.id,
      title: audit.title || "Untitled",
      description: audit.description || "No description",
      score: audit.score,
      scoreDisplayMode: audit.scoreDisplayMode || "numeric",
      numericValue: audit.numericValue,
      numericUnit: audit.numericUnit,
      details: simplifiedDetails,
      weight: ref.weight || 1,
    };
  });

  const failedAudits = performanceAudits
    .filter((audit) => audit.score !== null && audit.score < 1)
    .sort(
      (a, b) =>
        b.weight! * (1 - (b.score || 0)) - a.weight! * (1 - (a.score || 0))
    )
    .slice(0, FAILED_AUDITS_LIMIT);

  const passedAudits = performanceAudits.filter(
    (audit) => audit.score !== null && audit.score >= 1
  );
  const manualAudits = performanceAudits.filter(
    (audit) => audit.scoreDisplayMode === "manual"
  );
  const informativeAudits = performanceAudits.filter(
    (audit) => audit.scoreDisplayMode === "informative"
  );
  const notApplicableAudits = performanceAudits.filter(
    (audit) => audit.scoreDisplayMode === "notApplicable"
  );

  return {
    metadata,
    overallScore,
    failedAuditsCount: failedAudits.length,
    passedAuditsCount: passedAudits.length,
    manualAuditsCount: manualAudits.length,
    informativeAuditsCount: informativeAudits.length,
    notApplicableAuditsCount: notApplicableAudits.length,
    failedAudits,
  };
};
