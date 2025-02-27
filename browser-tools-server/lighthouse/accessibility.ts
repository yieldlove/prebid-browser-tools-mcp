import { Result as LighthouseResult } from "lighthouse";
import { AuditCategory, LighthouseReport } from "./types.js";
import { runLighthouseAudit } from "./index.js";

interface AccessibilityAudit {
  id: string; // e.g., "color-contrast"
  title: string; // e.g., "Color contrast is sufficient"
  description: string; // e.g., "Ensures text is readable..."
  score: number | null; // 0-1 (normalized), null for manual/informative
  scoreDisplayMode: string; // e.g., "binary", "numeric", "manual"
  details?: AuditDetails; // Optional, structured details
  weight?: number; // Optional, audit weight for impact calculation
}

type AuditDetails = {
  items?: Array<{
    node?: {
      selector: string; // e.g., ".my-class"
      snippet?: string; // HTML snippet
      nodeLabel?: string; // e.g., "Modify logging size limits / truncation"
      explanation?: string; // Explanation of why the node fails the audit
    };
    value?: string | number; // Specific value (e.g., contrast ratio)
    explanation?: string; // Explanation at the item level
  }>;
  debugData?: string; // Optional, debug information
  [key: string]: any; // Flexible for other detail types (tables, etc.)
};

const FAILED_AUDITS_LIMIT = 5;

// Define a maximum number of items to include in the audit details
const MAX_ITEMS_IN_DETAILS = 3;

/**
 * Runs an accessibility audit on the specified URL
 * @param url The URL to audit
 * @param limit Maximum number of issues to return
 * @returns Promise resolving to simplified accessibility audit results
 */
export async function runAccessibilityAudit(
  url: string
): Promise<LighthouseReport> {
  try {
    const lhr = await runLighthouseAudit(url, [AuditCategory.ACCESSIBILITY]);
    const accessibilityReport = extractLhrResult(lhr, url);
    return accessibilityReport;
  } catch (error) {
    throw new Error(
      `Accessibility audit failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

const extractLhrResult = (
  lhr: LighthouseResult,
  url: string
): LighthouseReport => {
  const categoryData = lhr.categories[AuditCategory.ACCESSIBILITY];
  console.log(categoryData);
  console.log(lhr);

  const metadata = {
    url,
    timestamp: lhr.fetchTime
      ? new Date(lhr.fetchTime).toISOString()
      : new Date().toISOString(),
    device: "desktop", // TODO: pass device from the request instead of hardcoding
    lighthouseVersion: lhr.lighthouseVersion,
  };

  if (!categoryData)
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

  const overallScore = Math.round((categoryData.score || 0) * 100);
  const auditRefs = categoryData.auditRefs || [];
  const audits = lhr.audits || {};

  const accessibilityAudits: AccessibilityAudit[] = auditRefs.map((ref) => {
    const audit = audits[ref.id];

    // Create a simplified version of the audit details
    let simplifiedDetails: AuditDetails | undefined;

    if (audit.details) {
      simplifiedDetails = {};

      // Only copy the items array if it exists
      if (
        (audit.details as any).items &&
        Array.isArray((audit.details as any).items)
      ) {
        // Limit the number of items to MAX_ITEMS_IN_DETAILS
        const limitedItems = (audit.details as any).items.slice(
          0,
          MAX_ITEMS_IN_DETAILS
        );

        simplifiedDetails.items = limitedItems.map((item: any) => {
          const simplifiedItem: any = {};

          // Only include node with selector if they exist
          if (item.node) {
            // Include the node with all its properties
            simplifiedItem.node = {
              selector: item.node.selector || null,
              nodeLabel: item.node.nodeLabel || null,
              snippet: item.node.snippet || null,
            };
            // Include explanation if it exists
            if (item.node.explanation) {
              simplifiedItem.node.explanation = item.node.explanation;
            }
          }

          // Include value if it exists
          if (item.value !== undefined) {
            simplifiedItem.value = item.value;
          }

          // Include explanation at the item level if it exists
          if (item.explanation) {
            simplifiedItem.explanation = item.explanation;
          }

          return simplifiedItem;
        });
      }

      // Copy any other essential properties that might be needed
      if ((audit.details as any).type) {
        simplifiedDetails.type = (audit.details as any).type;
      }

      // Include debugData if it exists
      if ((audit.details as any).debugData) {
        simplifiedDetails.debugData = (audit.details as any).debugData;
      }
    }

    return {
      id: ref.id,
      title: audit.title || "Untitled",
      description: audit.description || "No description",
      score: audit.score, // Individual audit score (0-1 or null)
      scoreDisplayMode: audit.scoreDisplayMode || "numeric",
      details: simplifiedDetails,
      weight: ref.weight || 1,
    };
  });

  const failedAudits = accessibilityAudits
    .filter((audit) => audit.score !== null && audit.score < 1)
    .sort(
      (a, b) =>
        b.weight! * (1 - (b.score || 0)) - a.weight! * (1 - (a.score || 0))
    )
    .slice(0, FAILED_AUDITS_LIMIT);

  const passedAudits = accessibilityAudits.filter(
    (audit) => audit.score !== null && audit.score >= 1
  );
  const manualAudits = accessibilityAudits.filter(
    (audit) => audit.scoreDisplayMode === "manual"
  );
  const informativeAudits = accessibilityAudits.filter(
    (audit) => audit.scoreDisplayMode === "informative"
  );
  const notApplicableAudits = accessibilityAudits.filter(
    (audit) => audit.scoreDisplayMode === "notApplicable"
  );

  const result = {
    metadata,
    overallScore,
    failedAuditsCount: failedAudits.length,
    passedAuditsCount: passedAudits.length,
    manualAuditsCount: manualAudits.length,
    informativeAuditsCount: informativeAudits.length,
    notApplicableAuditsCount: notApplicableAudits.length,
    failedAudits,
  } as LighthouseReport;

  console.log(result);
  failedAudits.forEach((audit) => {
    console.log(JSON.stringify(audit.details, null, 2));
  });
  return result;
};
