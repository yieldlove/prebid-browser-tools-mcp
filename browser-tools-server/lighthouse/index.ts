import lighthouse from "lighthouse";
import type { Result as LighthouseResult, Flags } from "lighthouse";
import {
  connectToHeadlessBrowser,
  scheduleBrowserCleanup,
} from "../browser-utils.js";
import {
  LighthouseConfig,
  AuditCategory,
  AuditIssue,
  LighthouseDetails,
  ImpactLevel,
} from "./types.js";

// ===== Type Definitions =====

/**
 * Details about an HTML element that has accessibility issues
 */
export interface ElementDetails {
  selector: string;
  snippet: string;
  explanation: string;
  url: string;
  size: number;
  wastedMs: number;
  wastedBytes: number;
}

/**
 * Creates a Lighthouse configuration object
 * @param categories Array of categories to audit
 * @returns Lighthouse configuration and flags
 */
export function createLighthouseConfig(
  categories: string[] = [AuditCategory.ACCESSIBILITY]
): LighthouseConfig {
  return {
    flags: {
      output: ["json"],
      onlyCategories: categories,
      formFactor: "desktop",
      port: undefined as number | undefined,
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false,
      },
    },
    config: {
      extends: "lighthouse:default",
      settings: {
        onlyCategories: categories,
        emulatedFormFactor: "desktop",
        throttling: { cpuSlowdownMultiplier: 1 },
      },
    },
  };
}

/**
 * Runs a Lighthouse audit on the specified URL via CDP
 * @param url The URL to audit
 * @param categories Array of categories to audit, defaults to ["accessibility"]
 * @returns Promise resolving to the Lighthouse result
 * @throws Error if the URL is invalid or if the audit fails
 */
export async function runLighthouseOnExistingTab(
  url: string,
  categories: string[] = [AuditCategory.ACCESSIBILITY]
): Promise<LighthouseResult> {
  console.log(`Starting Lighthouse ${categories.join(", ")} audit for: ${url}`);

  if (!url || url === "about:blank") {
    console.error("Invalid URL for Lighthouse audit");
    throw new Error(
      "Cannot run audit on an empty page or about:blank. Please navigate to a valid URL first."
    );
  }

  try {
    // Always use a dedicated headless browser for audits
    console.log("Using dedicated headless browser for audit");

    // Determine if this is a performance audit - we need to load all resources for performance audits
    const isPerformanceAudit = categories.includes(AuditCategory.PERFORMANCE);

    // For performance audits, we want to load all resources
    // For accessibility or other audits, we can block non-essential resources
    try {
      const { port } = await connectToHeadlessBrowser(url, {
        blockResources: !isPerformanceAudit,
        // Don't pass an audit type - the blockResources flag is what matters
      });

      console.log(`Connected to browser on port: ${port}`);

      // Create Lighthouse config
      const { flags, config } = createLighthouseConfig(categories);
      flags.port = port;

      console.log(
        `Running Lighthouse with categories: ${categories.join(", ")}`
      );
      const runnerResult = await lighthouse(url, flags as Flags, config);
      console.log("Lighthouse audit completed");

      if (!runnerResult?.lhr) {
        console.error("Lighthouse audit failed to produce results");
        throw new Error("Lighthouse audit failed to produce results");
      }

      // Schedule browser cleanup after a delay to allow for subsequent audits
      scheduleBrowserCleanup();

      // Return the result
      const result = runnerResult.lhr;
      return result;
    } catch (browserError) {
      // Check if the error is related to Chrome/Edge not being available
      const errorMessage =
        browserError instanceof Error
          ? browserError.message
          : String(browserError);
      if (
        errorMessage.includes("Chrome could not be found") ||
        errorMessage.includes("Failed to launch browser") ||
        errorMessage.includes("spawn ENOENT")
      ) {
        throw new Error(
          "Chrome or Edge browser could not be found. Please ensure that Chrome or Edge is installed on your system to run audits."
        );
      }
      // Re-throw other errors
      throw browserError;
    }
  } catch (error) {
    console.error("Lighthouse audit failed:", error);
    // Schedule browser cleanup even if the audit fails
    scheduleBrowserCleanup();
    throw new Error(
      `Lighthouse audit failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Export from specific audit modules
export * from "./accessibility.js";
export * from "./performance.js";
export * from "./seo.js";
export * from "./types.js";

/**
 * Maps Lighthouse audit items to ElementDetails objects
 * @param items Array of audit items from Lighthouse
 * @param detailed Whether to include all items or limit them
 * @returns Array of ElementDetails objects
 */
export function mapAuditItemsToElements(
  items: Record<string, unknown>[] = [],
  detailed: boolean = false
): ElementDetails[] {
  const elements = items.map(
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
          ((item.node as Record<string, unknown>)?.explanation as string) ||
          (item.explanation as string) ||
          "No explanation available",
        url:
          (item.url as string) ||
          ((item.node as Record<string, unknown>)?.url as string) ||
          "",
        size: (item.totalBytes as number) || (item.transferSize as number) || 0,
        wastedMs: (item.wastedMs as number) || 0,
        wastedBytes: (item.wastedBytes as number) || 0,
      } as ElementDetails)
  );

  return detailed ? elements : elements.slice(0, 3);
}

/**
 * Creates an AuditIssue object from Lighthouse audit data
 * @param audit The Lighthouse audit object
 * @param ref The audit reference object
 * @param details The audit details object
 * @param elements Array of ElementDetails objects
 * @param categoryName The category name
 * @param impact The impact level (optional)
 * @returns An AuditIssue object
 */
export function createAuditIssue(
  audit: any,
  ref: any,
  details: LighthouseDetails,
  elements: ElementDetails[],
  categoryName: string,
  impact?: string
): AuditIssue {
  return {
    id: audit.id,
    title: audit.title,
    description: audit.description,
    score: audit.score || 0,
    details: { type: details?.type || "unknown" },
    category: categoryName,
    wcagReference: ref.relevantAudits || [],
    impact:
      impact ||
      ((details?.items?.[0] as Record<string, unknown>)?.impact as string) ||
      ImpactLevel.MODERATE,
    elements: elements,
    failureSummary:
      ((details?.items?.[0] as Record<string, unknown>)
        ?.failureSummary as string) ||
      audit.explanation ||
      "No failure summary available",
    recommendations: [],
  };
}

/**
 * Creates audit metadata from Lighthouse results
 * @param lhr The Lighthouse result object
 * @returns Audit metadata object
 */
export function createAuditMetadata(lhr: LighthouseResult): any {
  return {
    fetchTime: lhr.fetchTime || new Date().toISOString(),
    url: lhr.finalUrl || "Unknown URL",
    deviceEmulation: "desktop",
    categories: Object.keys(lhr.categories),
    totalAudits: Object.keys(lhr.audits || {}).length,
    passedAudits: Object.values(lhr.audits || {}).filter(
      (audit) => audit.score === 1
    ).length,
    failedAudits: Object.values(lhr.audits || {}).filter(
      (audit) => audit.score !== null && audit.score < 1
    ).length,
  };
}
