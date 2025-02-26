import type { Result as LighthouseResult } from "lighthouse";
import {
  AuditResult,
  AuditIssue,
  LighthouseDetails,
  ElementDetails,
  ImpactLevel,
  AuditCategory,
} from "./types.js";
import { runLighthouseOnExistingTab } from "./index.js";

/**
 * Extracts simplified accessibility issues from Lighthouse results
 * @param lhr The Lighthouse result object
 * @param limit Maximum number of issues to return
 * @param detailed Whether to include detailed information about each issue
 * @returns Processed audit result with categorized issues
 */
export function extractAccessibilityIssues(
  lhr: LighthouseResult,
  limit: number = 5,
  detailed: boolean = false
): Partial<AuditResult> {
  const allIssues: AuditIssue[] = [];
  const categoryScores: { [key: string]: number } = {};

  // Process each category
  Object.entries(lhr.categories).forEach(([categoryName, category]) => {
    const score = (category.score || 0) * 100;
    categoryScores[categoryName] = score;

    // Only process audits that actually failed or have warnings
    const failedAudits = (category.auditRefs || [])
      .map((ref) => ({ ref, audit: lhr.audits[ref.id] }))
      .filter(
        ({ audit }) =>
          // Include if score is less than 100% or has actual items to fix
          audit?.score !== null &&
          (audit.score < 1 ||
            ((audit.details as LighthouseDetails)?.items?.length || 0) > 0)
      );

    if (failedAudits.length > 0) {
      failedAudits.forEach(({ ref, audit }) => {
        const details = audit.details as LighthouseDetails;

        // Extract actionable elements that need fixing
        const elements = (details?.items || []).map(
          (item: Record<string, unknown>) =>
            ({
              selector:
                ((item.node as Record<string, unknown>)?.selector as string) ||
                (item.selector as string) ||
                "Unknown selector",
              snippet:
                ((item.node as Record<string, unknown>)?.snippet as string) ||
                (item.snippet as string) ||
                "No snippet available",
              explanation:
                ((item.node as Record<string, unknown>)
                  ?.explanation as string) ||
                (item.explanation as string) ||
                "No explanation available",
              url:
                (item.url as string) ||
                ((item.node as Record<string, unknown>)?.url as string) ||
                "",
              size:
                (item.totalBytes as number) ||
                (item.transferSize as number) ||
                0,
              wastedMs: (item.wastedMs as number) || 0,
              wastedBytes: (item.wastedBytes as number) || 0,
            } as ElementDetails)
        );

        if (elements.length > 0 || (audit.score || 0) < 1) {
          const issue: AuditIssue = {
            id: audit.id,
            title: audit.title,
            description: audit.description,
            score: audit.score || 0,
            details: detailed ? details : { type: details.type },
            category: categoryName,
            wcagReference: ref.relevantAudits || [],
            impact:
              ((details?.items?.[0] as Record<string, unknown>)
                ?.impact as string) || ImpactLevel.MODERATE,
            elements: detailed ? elements : elements.slice(0, 3),
            failureSummary:
              ((details?.items?.[0] as Record<string, unknown>)
                ?.failureSummary as string) ||
              audit.explanation ||
              "No failure summary available",
            recommendations: [],
          };

          allIssues.push(issue);
        }
      });
    }
  });

  // Sort issues by impact and score
  allIssues.sort((a, b) => {
    const impactOrder = {
      [ImpactLevel.CRITICAL]: 0,
      [ImpactLevel.SERIOUS]: 1,
      [ImpactLevel.MODERATE]: 2,
      [ImpactLevel.MINOR]: 3,
    };
    const aImpact = impactOrder[a.impact as keyof typeof impactOrder] || 4;
    const bImpact = impactOrder[b.impact as keyof typeof impactOrder] || 4;

    if (aImpact !== bImpact) return aImpact - bImpact;
    return a.score - b.score;
  });

  // Return only the specified number of issues
  const limitedIssues = allIssues.slice(0, limit);

  return {
    score: categoryScores.accessibility || 0,
    categoryScores,
    issues: limitedIssues,
    ...(detailed && {
      auditMetadata: {
        fetchTime: lhr.fetchTime || new Date().toISOString(),
        url: lhr.finalUrl || "Unknown URL",
        deviceEmulation: "desktop",
        categories: Object.keys(lhr.categories),
        totalAudits: Object.keys(lhr.audits).length,
        passedAudits: Object.values(lhr.audits).filter(
          (audit) => audit.score === 1
        ).length,
        failedAudits: Object.values(lhr.audits).filter(
          (audit) => audit.score !== null && audit.score < 1
        ).length,
      },
    }),
  };
}

/**
 * Runs an accessibility audit on the specified URL
 * @param url The URL to audit
 * @param limit Maximum number of issues to return
 * @param detailed Whether to include detailed information about each issue
 * @returns Promise resolving to the processed accessibility audit results
 */
export async function runAccessibilityAudit(
  url: string,
  limit: number = 5,
  detailed: boolean = false
): Promise<Partial<AuditResult>> {
  try {
    // Run Lighthouse audit with accessibility category
    const lhr = await runLighthouseOnExistingTab(url, [
      AuditCategory.ACCESSIBILITY,
    ]);

    // Extract and process accessibility issues
    return extractAccessibilityIssues(lhr, limit, detailed);
  } catch (error) {
    throw new Error(
      `Accessibility audit failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
