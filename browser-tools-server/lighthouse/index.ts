import lighthouse from "lighthouse";
import type { Result as LighthouseResult, Flags } from "lighthouse";
import {
  connectToHeadlessBrowser,
  scheduleBrowserCleanup,
} from "../browser-utils.js";
import { LighthouseConfig, AuditCategory } from "./types.js";

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

  if (!url) {
    console.error("URL is required for Lighthouse audit");
    throw new Error("URL is required for Lighthouse audit");
  }

  try {
    // Always use a dedicated headless browser for audits
    console.log("Using dedicated headless browser for audit");

    // Determine if this is a performance audit - we need to load all resources for performance audits
    const isPerformanceAudit = categories.includes(AuditCategory.PERFORMANCE);

    // For performance audits, we want to load all resources
    // For accessibility or other audits, we can block non-essential resources
    const { port } = await connectToHeadlessBrowser(url, {
      blockResources: !isPerformanceAudit,
      // Don't pass an audit type - the blockResources flag is what matters
    });

    console.log(`Connected to browser on port: ${port}`);

    // Create Lighthouse config
    const { flags, config } = createLighthouseConfig(categories);
    flags.port = port;

    console.log(`Running Lighthouse with categories: ${categories.join(", ")}`);
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
export * from "./types.js";
