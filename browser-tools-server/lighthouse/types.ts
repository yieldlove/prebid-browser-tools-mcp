/**
 * Types for Lighthouse audit results and related data structures
 */

/**
 * Details about an HTML element that has accessibility or performance issues
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
 * Represents a single audit issue found during an audit
 */
export interface AuditIssue {
  id: string;
  title: string;
  description: string;
  score: number;
  details: LighthouseDetails;
  wcagReference: string[];
  impact: string;
  elements: ElementDetails[];
  failureSummary: string;
  recommendations?: string[];
  category?: string;
}

/**
 * The complete result of an audit
 */
export interface AuditResult {
  score: number;
  categoryScores: { [key: string]: number };
  issues: AuditIssue[];
  auditMetadata?: {
    fetchTime: string;
    url: string;
    deviceEmulation: string;
    categories: string[];
    totalAudits: number;
    passedAudits: number;
    failedAudits: number;
  };
}

/**
 * Details structure from Lighthouse audit results
 */
export interface LighthouseDetails {
  type: string;
  headings?: Array<{
    key?: string;
    itemType?: string;
    text?: string;
  }>;
  items?: Array<Record<string, unknown>>;
  debugData?: {
    type: string;
    impact?: string;
    tags?: string[];
  };
}

/**
 * Configuration options for Lighthouse audits
 */
export interface LighthouseConfig {
  flags: {
    output: string[];
    onlyCategories: string[];
    formFactor: string;
    port: number | undefined;
    screenEmulation: {
      mobile: boolean;
      width: number;
      height: number;
      deviceScaleFactor: number;
      disabled: boolean;
    };
  };
  config: {
    extends: string;
    settings: {
      onlyCategories: string[];
      emulatedFormFactor: string;
      throttling: {
        cpuSlowdownMultiplier: number;
      };
    };
  };
}

/**
 * Audit categories available in Lighthouse
 */
export enum AuditCategory {
  ACCESSIBILITY = "accessibility",
  PERFORMANCE = "performance",
  SEO = "seo",
  BEST_PRACTICES = "best-practices",
  PWA = "pwa",
}

/**
 * Impact levels for audit issues
 */
export enum ImpactLevel {
  CRITICAL = "critical",
  SERIOUS = "serious",
  MODERATE = "moderate",
  MINOR = "minor",
}
