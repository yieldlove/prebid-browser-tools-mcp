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
 * Extracts SEO issues from Lighthouse results
 * @param lhr The Lighthouse result object
 * @param limit Maximum number of issues to return
 * @param detailed Whether to include detailed information about each issue
 * @returns Processed audit result with SEO issues
 */
export function extractSEOIssues(
  lhr: LighthouseResult,
  limit: number = 5,
  detailed: boolean = false
): Partial<AuditResult> {
  const allIssues: AuditIssue[] = [];
  const categoryScores: { [key: string]: number } = {};

  // Check if lhr and categories exist
  if (!lhr || !lhr.categories) {
    console.error("Invalid Lighthouse result: missing categories");
    return {
      score: 0,
      categoryScores: {},
      issues: [],
    };
  }

  // Process SEO category
  Object.entries(lhr.categories).forEach(([categoryName, category]) => {
    if (categoryName !== AuditCategory.SEO) return;

    const score = (category.score || 0) * 100;
    categoryScores[categoryName] = score;

    // Check if auditRefs exists
    if (!category.auditRefs) {
      console.error(`No auditRefs found for category: ${categoryName}`);
      return;
    }

    // Only process audits that actually failed or have warnings
    const failedAudits = category.auditRefs
      .map((ref) => {
        const audit = lhr.audits?.[ref.id];
        if (!audit) {
          console.error(`Audit not found for ref.id: ${ref.id}`);
          return null;
        }
        return { ref, audit };
      })
      .filter(
        (item): item is { ref: any; audit: any } =>
          item !== null &&
          item.audit?.score !== null &&
          (item.audit.score < 1 ||
            ((item.audit.details as LighthouseDetails)?.items?.length || 0) > 0)
      );

    if (failedAudits.length > 0) {
      failedAudits.forEach(({ ref, audit }) => {
        try {
          const details = audit.details as LighthouseDetails;

          // Check if details exists
          if (!details) {
            console.error(`No details found for audit: ${audit.id}`);
            return;
          }

          // Use the shared helper function to extract elements
          const elements = mapAuditItemsToElements(
            details.items || [],
            detailed
          );

          if (elements.length > 0 || (audit.score || 0) < 1) {
            // Use the shared helper function to create an audit issue
            const impact = getSEOImpact(audit.score || 0);
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
        } catch (error) {
          console.error(`Error processing audit ${audit.id}: ${error}`);
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
    score: categoryScores.seo || 0,
    categoryScores,
    issues: limitedIssues,
    ...(detailed && {
      auditMetadata: createAuditMetadata(lhr),
    }),
  };
}

/**
 * Determines the impact level based on the SEO score
 * @param score The SEO score (0-1)
 * @returns Impact level string
 */
function getSEOImpact(score: number): string {
  if (score < 0.5) return ImpactLevel.CRITICAL;
  if (score < 0.7) return ImpactLevel.SERIOUS;
  if (score < 0.9) return ImpactLevel.MODERATE;
  return ImpactLevel.MINOR;
}

/**
 * Runs an SEO audit on the specified URL
 * @param url The URL to audit
 * @param limit Maximum number of issues to return
 * @param detailed Whether to include detailed information about each issue
 * @returns Promise resolving to the processed SEO audit results
 */
export async function runSEOAudit(
  url: string,
  limit: number = 5,
  detailed: boolean = false
): Promise<Partial<AuditResult>> {
  try {
    // Run Lighthouse audit with SEO category
    const lhr = await runLighthouseOnExistingTab(url, [AuditCategory.SEO]);

    // Extract and process SEO issues
    const result = extractSEOIssues(lhr, limit, detailed);

    return result;
  } catch (error) {
    throw new Error(
      `SEO audit failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
