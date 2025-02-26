import type { Result as LighthouseResult } from "lighthouse";
import {
  AuditResult,
  AuditIssue,
  LighthouseDetails,
  ImpactLevel,
  AuditCategory,
} from "./types.js";
import {
  runLighthouseOnExistingTab,
  mapAuditItemsToElements,
  createAuditIssue,
  createAuditMetadata,
} from "./index.js";

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

        // Use the shared helper function to extract elements
        const elements = mapAuditItemsToElements(
          details?.items || [],
          detailed
        );

        if (elements.length > 0 || (audit.score || 0) < 1) {
          // Use the shared helper function to create an audit issue
          const impact =
            ((details?.items?.[0] as Record<string, unknown>)
              ?.impact as string) || ImpactLevel.MODERATE;
          const issue = createAuditIssue(
            audit,
            ref,
            details,
            elements,
            categoryName,
            impact
          );

          // Add detailed details if requested
          if (detailed) {
            issue.details = details;
          }

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
      auditMetadata: createAuditMetadata(lhr),
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
