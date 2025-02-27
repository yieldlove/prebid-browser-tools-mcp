import { Result as LighthouseResult } from "lighthouse";
import { AuditCategory, LighthouseReport } from "./types.js";
import { runLighthouseAudit } from "./index.js";

interface SEOAudit {
  id: string; // e.g., "meta-description"
  title: string; // e.g., "Document has a meta description"
  description: string; // e.g., "Meta descriptions improve SEO..."
  score: number | null; // 0-1 or null
  scoreDisplayMode: string; // e.g., "binary"
  details?: SEOAuditDetails; // Optional, structured details
  weight?: number; // For prioritization
}

interface SEOAuditDetails {
  items?: Array<{
    selector?: string; // e.g., "meta[name='description']"
    issue?: string; // e.g., "Meta description is missing"
    value?: string; // e.g., Current meta description text
  }>;
  type?: string; // e.g., "table"
}

const FAILED_AUDITS_LIMIT = 5;
const MAX_ITEMS_IN_DETAILS = 3;

export async function runSEOAudit(url: string): Promise<LighthouseReport> {
  try {
    const lhr = await runLighthouseAudit(url, [AuditCategory.SEO]);
    return extractSEOResult(lhr, url);
  } catch (error) {
    throw new Error(
      `SEO audit failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

const extractSEOResult = (
  lhr: LighthouseResult,
  url: string
): LighthouseReport => {
  const categoryData = lhr.categories[AuditCategory.SEO];
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

  const seoAudits: SEOAudit[] = auditRefs.map((ref) => {
    const audit = audits[ref.id];
    let simplifiedDetails: SEOAuditDetails | undefined;

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
          if (item.node?.selector) simplifiedItem.selector = item.node.selector;
          if (item.explanation)
            simplifiedItem.issue = item.explanation.split("\n")[0]; // First line for brevity
          if (item.value) simplifiedItem.value = item.value; // e.g., meta description text
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
      details: simplifiedDetails,
      weight: ref.weight || 1,
    };
  });

  const failedAudits = seoAudits
    .filter((audit) => audit.score !== null && audit.score < 1)
    .sort(
      (a, b) =>
        b.weight! * (1 - (b.score || 0)) - a.weight! * (1 - (a.score || 0))
    )
    .slice(0, FAILED_AUDITS_LIMIT);

  const passedAudits = seoAudits.filter(
    (audit) => audit.score !== null && audit.score >= 1
  );
  const manualAudits = seoAudits.filter(
    (audit) => audit.scoreDisplayMode === "manual"
  );
  const informativeAudits = seoAudits.filter(
    (audit) => audit.scoreDisplayMode === "informative"
  );
  const notApplicableAudits = seoAudits.filter(
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
