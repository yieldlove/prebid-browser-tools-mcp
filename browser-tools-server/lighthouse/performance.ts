import { Result as LighthouseResult } from "lighthouse";
import { AuditCategory, LighthouseReport } from "./types.js";
import { runLighthouseAudit } from "./index.js";

interface PerformanceAuditDetails {
  items?: Array<{
    resourceUrl?: string; // e.g., "https://example.com/script.js" (for render-blocking resources)
    wastedMs?: number; // e.g., 150 (potential savings)
    elementSelector?: string; // e.g., "img.hero" (for LCP element)
    timing?: number; // e.g., 2.5 (specific timing value)
  }>;
  type?: string; // e.g., "opportunity" or "table"
}

// AI-optimized performance metric format
interface AIOptimizedMetric {
  id: string; // Short ID like "lcp", "fcp"
  score: number | null; // 0-1 score
  value_ms: number; // Value in milliseconds
  element_type?: string; // For LCP: "image", "text", etc.
  element_selector?: string; // DOM selector for the element
  element_url?: string; // For images/videos
  element_content?: string; // For text content (truncated)
  passes_core_web_vital?: boolean; // Whether this metric passes as a Core Web Vital
}

// AI-optimized opportunity format
interface AIOptimizedOpportunity {
  id: string; // Like "render_blocking", "http2"
  savings_ms: number; // Time savings in ms
  severity?: "critical" | "major" | "minor"; // Severity classification
  resources: Array<{
    url: string; // Resource URL
    savings_ms?: number; // Individual resource savings
    size_kb?: number; // Size in KB
    type?: string; // Resource type (js, css, img, etc.)
    is_third_party?: boolean; // Whether this is a third-party resource
  }>;
}

// Page stats for AI analysis
interface AIPageStats {
  total_size_kb: number; // Total page weight in KB
  total_requests: number; // Total number of requests
  resource_counts: {
    // Count by resource type
    js: number;
    css: number;
    img: number;
    font: number;
    other: number;
  };
  third_party_size_kb: number; // Size of third-party resources
  main_thread_blocking_time_ms: number; // Time spent blocking the main thread
}

// AI-optimized performance report
interface AIOptimizedPerformanceReport {
  metadata: {
    url: string; // Page URL
    timestamp: string; // ISO timestamp
    device: string; // Device type (desktop, mobile)
    lighthouseVersion: string; // Lighthouse version used
  };
  score: number; // Overall score (0-100)
  audit_counts: {
    // Counts of different audit types
    failed: number;
    passed: number;
    manual: number;
    informative: number;
    not_applicable: number;
  };
  metrics: AIOptimizedMetric[];
  opportunities: AIOptimizedOpportunity[];
  page_stats?: AIPageStats; // Optional page statistics
  prioritized_recommendations?: string[]; // Ordered list of recommendations
}

/**
 * Performance audit adapted for AI consumption
 * This format is optimized for AI agents with:
 * - Concise, relevant information without redundant descriptions
 * - Key metrics and opportunities clearly structured
 * - Only actionable data that an AI can use for recommendations
 */
export async function runPerformanceAudit(url: string): Promise<any> {
  try {
    const lhr = await runLighthouseAudit(url, [AuditCategory.PERFORMANCE]);
    return extractAIOptimizedData(lhr, url);
  } catch (error) {
    throw new Error(
      `Performance audit failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Extract AI-optimized performance data from Lighthouse results
 */
const extractAIOptimizedData = (
  lhr: LighthouseResult,
  url: string
): AIOptimizedPerformanceReport => {
  const audits = lhr.audits || {};
  const categoryData = lhr.categories[AuditCategory.PERFORMANCE];
  const score = Math.round((categoryData?.score || 0) * 100);

  // Add metadata
  const metadata = {
    url,
    timestamp: lhr.fetchTime || new Date().toISOString(),
    device: "desktop", // This could be made configurable
    lighthouseVersion: lhr.lighthouseVersion,
  };

  // Count audits by type
  const auditRefs = categoryData?.auditRefs || [];
  let failedCount = 0;
  let passedCount = 0;
  let manualCount = 0;
  let informativeCount = 0;
  let notApplicableCount = 0;

  auditRefs.forEach((ref) => {
    const audit = audits[ref.id];
    if (!audit) return;

    if (audit.scoreDisplayMode === "manual") {
      manualCount++;
    } else if (audit.scoreDisplayMode === "informative") {
      informativeCount++;
    } else if (audit.scoreDisplayMode === "notApplicable") {
      notApplicableCount++;
    } else if (audit.score !== null) {
      if (audit.score >= 0.9) {
        passedCount++;
      } else {
        failedCount++;
      }
    }
  });

  const audit_counts = {
    failed: failedCount,
    passed: passedCount,
    manual: manualCount,
    informative: informativeCount,
    not_applicable: notApplicableCount,
  };

  const metrics: AIOptimizedMetric[] = [];
  const opportunities: AIOptimizedOpportunity[] = [];

  // Extract core metrics
  if (audits["largest-contentful-paint"]) {
    const lcp = audits["largest-contentful-paint"];
    const lcpElement = audits["largest-contentful-paint-element"];

    const metric: AIOptimizedMetric = {
      id: "lcp",
      score: lcp.score,
      value_ms: Math.round(lcp.numericValue || 0),
      passes_core_web_vital: lcp.score !== null && lcp.score >= 0.9,
    };

    // Enhanced LCP element detection
    console.log("DEBUG: Attempting to find LCP element information");

    // 1. Try from largest-contentful-paint-element audit
    if (lcpElement && lcpElement.details) {
      console.log("DEBUG: Found LCP element audit with details");
      const lcpDetails = lcpElement.details as any;
      console.log(
        "DEBUG: LCP element details:",
        JSON.stringify(lcpDetails).substring(0, 500)
      );

      // First attempt - try to get directly from items
      if (
        lcpDetails.items &&
        Array.isArray(lcpDetails.items) &&
        lcpDetails.items.length > 0
      ) {
        const item = lcpDetails.items[0];
        console.log(
          "DEBUG: Found LCP element item:",
          JSON.stringify(item).substring(0, 500)
        );

        // For text elements in tables format
        if (item.type === "table" && item.items && item.items.length > 0) {
          const firstTableItem = item.items[0];
          console.log(
            "DEBUG: Found table format item:",
            JSON.stringify(firstTableItem).substring(0, 500)
          );

          if (firstTableItem.node) {
            if (firstTableItem.node.selector) {
              metric.element_selector = firstTableItem.node.selector;
              console.log(
                "DEBUG: Found LCP selector from table:",
                metric.element_selector
              );
            }

            // Determine element type based on path or selector
            const path = firstTableItem.node.path;
            const selector = firstTableItem.node.selector || "";

            if (path) {
              console.log("DEBUG: Element path:", path);
              if (
                selector.includes(" > img") ||
                selector.includes(" img") ||
                selector.endsWith("img") ||
                path.includes(",IMG")
              ) {
                metric.element_type = "image";
                console.log(
                  "DEBUG: Element type set to image based on path/selector"
                );

                // Try to extract image name from selector
                const imgMatch = selector.match(/img[.][^> ]+/);
                if (imgMatch && !metric.element_url) {
                  metric.element_url = imgMatch[0];
                  console.log(
                    "DEBUG: Extracted image class name as URL fallback:",
                    metric.element_url
                  );
                }
              } else if (
                path.includes(",SPAN") ||
                path.includes(",P") ||
                path.includes(",H")
              ) {
                metric.element_type = "text";
                console.log("DEBUG: Element type set to text based on path");
              }
            }

            // Try to extract text content if available
            if (firstTableItem.node.nodeLabel) {
              console.log("DEBUG: Node label:", firstTableItem.node.nodeLabel);
              metric.element_content = firstTableItem.node.nodeLabel.substring(
                0,
                100
              );
            }
          }
        }
        // Original handling for direct items
        else if (item.node?.nodeLabel) {
          console.log("DEBUG: LCP element node label:", item.node.nodeLabel);
          // Determine element type from node label
          if (item.node.nodeLabel.startsWith("<img")) {
            metric.element_type = "image";
            // Try to extract image URL from the node snippet
            const match = item.node.snippet?.match(/src="([^"]+)"/);
            if (match && match[1]) {
              metric.element_url = match[1];
              console.log(
                "DEBUG: Found LCP image URL from node label:",
                metric.element_url
              );
            }
          } else if (item.node.nodeLabel.startsWith("<video")) {
            metric.element_type = "video";
          } else if (item.node.nodeLabel.startsWith("<h")) {
            metric.element_type = "heading";
          } else {
            metric.element_type = "text";
          }

          if (item.node?.selector) {
            metric.element_selector = item.node.selector;
            console.log(
              "DEBUG: Found LCP element selector:",
              metric.element_selector
            );
          }
        }
      }
    } else {
      console.log("DEBUG: No LCP element audit with details found");
    }

    // 2. Try from lcp-lazy-loaded audit
    const lcpImageAudit = audits["lcp-lazy-loaded"];
    if (lcpImageAudit && lcpImageAudit.details) {
      console.log("DEBUG: Found LCP lazy-loaded audit with details");
      const lcpImageDetails = lcpImageAudit.details as any;

      if (
        lcpImageDetails.items &&
        Array.isArray(lcpImageDetails.items) &&
        lcpImageDetails.items.length > 0
      ) {
        const item = lcpImageDetails.items[0];
        console.log(
          "DEBUG: LCP lazy-loaded item:",
          JSON.stringify(item).substring(0, 500)
        );

        if (item.url) {
          metric.element_type = "image";
          metric.element_url = item.url;
          console.log(
            "DEBUG: Found LCP image URL from lazy-loaded:",
            metric.element_url
          );
        }
      }
    } else {
      console.log("DEBUG: No LCP lazy-loaded audit with details found");
    }

    // 3. Try directly from the LCP audit details
    if (!metric.element_url && lcp.details) {
      console.log("DEBUG: Trying to extract from LCP audit details directly");
      const lcpDirectDetails = lcp.details as any;
      console.log(
        "DEBUG: LCP audit details:",
        JSON.stringify(lcpDirectDetails).substring(0, 500)
      );

      if (lcpDirectDetails.items && Array.isArray(lcpDirectDetails.items)) {
        for (const item of lcpDirectDetails.items) {
          console.log(
            "DEBUG: LCP direct item:",
            JSON.stringify(item).substring(0, 500)
          );

          if (item.url || (item.node && item.node.path)) {
            if (item.url) {
              metric.element_url = item.url;
              metric.element_type = item.url.match(
                /\.(jpg|jpeg|png|gif|webp|svg)$/i
              )
                ? "image"
                : "resource";
              console.log(
                "DEBUG: Found LCP URL from direct details:",
                metric.element_url
              );
            }
            if (item.node && item.node.selector) {
              metric.element_selector = item.node.selector;
              console.log(
                "DEBUG: Found LCP selector from direct details:",
                metric.element_selector
              );
            }
            break;
          }
        }
      }
    }

    // 4. Check for specific audit that might contain image info
    const largestImageAudit = audits["largest-image-paint"];
    if (largestImageAudit && largestImageAudit.details) {
      console.log("DEBUG: Found largest-image-paint audit");
      const imageDetails = largestImageAudit.details as any;

      if (
        imageDetails.items &&
        Array.isArray(imageDetails.items) &&
        imageDetails.items.length > 0
      ) {
        const item = imageDetails.items[0];
        console.log(
          "DEBUG: Largest image item:",
          JSON.stringify(item).substring(0, 500)
        );

        if (item.url) {
          // If we have a large image that's close in time to LCP, it's likely the LCP element
          metric.element_type = "image";
          metric.element_url = item.url;
          console.log(
            "DEBUG: Found image URL from largest-image-paint:",
            metric.element_url
          );
        }
      }
    }

    // 5. Check for network requests audit to find image resources
    if (!metric.element_url) {
      console.log("DEBUG: Checking network requests for potential LCP images");
      const networkRequests = audits["network-requests"];

      if (networkRequests && networkRequests.details) {
        const networkDetails = networkRequests.details as any;

        if (networkDetails.items && Array.isArray(networkDetails.items)) {
          // Get all image resources loaded close to the LCP time
          const lcpTime = lcp.numericValue || 0;
          const imageResources = networkDetails.items
            .filter(
              (item: any) =>
                item.url &&
                item.mimeType &&
                item.mimeType.startsWith("image/") &&
                item.endTime &&
                Math.abs(item.endTime - lcpTime) < 500 // Within 500ms of LCP
            )
            .sort(
              (a: any, b: any) =>
                Math.abs(a.endTime - lcpTime) - Math.abs(b.endTime - lcpTime)
            );

          if (imageResources.length > 0) {
            const closestImage = imageResources[0];
            console.log(
              "DEBUG: Found potential LCP image from network:",
              closestImage.url
            );

            if (!metric.element_type) {
              metric.element_type = "image";
              metric.element_url = closestImage.url;
            }
          }
        }
      }
    }

    console.log(
      "DEBUG: Final LCP element info:",
      metric.element_type || "unknown type",
      metric.element_url || "no URL",
      metric.element_selector || "no selector"
    );

    metrics.push(metric);
  }

  if (audits["first-contentful-paint"]) {
    const fcp = audits["first-contentful-paint"];
    metrics.push({
      id: "fcp",
      score: fcp.score,
      value_ms: Math.round(fcp.numericValue || 0),
      passes_core_web_vital: fcp.score !== null && fcp.score >= 0.9,
    });
  }

  if (audits["speed-index"]) {
    const si = audits["speed-index"];
    metrics.push({
      id: "si",
      score: si.score,
      value_ms: Math.round(si.numericValue || 0),
    });
  }

  if (audits["interactive"]) {
    const tti = audits["interactive"];
    metrics.push({
      id: "tti",
      score: tti.score,
      value_ms: Math.round(tti.numericValue || 0),
    });
  }

  // Add CLS (Cumulative Layout Shift)
  if (audits["cumulative-layout-shift"]) {
    const cls = audits["cumulative-layout-shift"];
    metrics.push({
      id: "cls",
      score: cls.score,
      // CLS is not in ms, but a unitless value
      value_ms: Math.round((cls.numericValue || 0) * 1000) / 1000, // Convert to 3 decimal places
      passes_core_web_vital: cls.score !== null && cls.score >= 0.9,
    });
  }

  // Add TBT (Total Blocking Time)
  if (audits["total-blocking-time"]) {
    const tbt = audits["total-blocking-time"];
    metrics.push({
      id: "tbt",
      score: tbt.score,
      value_ms: Math.round(tbt.numericValue || 0),
      passes_core_web_vital: tbt.score !== null && tbt.score >= 0.9,
    });
  }

  // Extract opportunities
  if (audits["render-blocking-resources"]) {
    const rbrAudit = audits["render-blocking-resources"];
    const opportunity: AIOptimizedOpportunity = {
      id: "render_blocking_resources",
      savings_ms: Math.round(rbrAudit.numericValue || 0),
      resources: [],
    };

    const rbrDetails = rbrAudit.details as any;
    if (rbrDetails && rbrDetails.items && Array.isArray(rbrDetails.items)) {
      rbrDetails.items.forEach((item: { url?: string; wastedMs?: number }) => {
        if (item.url) {
          // Extract file name from full URL
          const fileName = item.url.split("/").pop() || item.url;
          opportunity.resources.push({
            url: fileName,
            savings_ms: Math.round(item.wastedMs || 0),
          });
        }
      });
    }

    if (opportunity.resources.length > 0) {
      opportunities.push(opportunity);
    }
  }

  if (audits["uses-http2"]) {
    const http2Audit = audits["uses-http2"];
    const opportunity: AIOptimizedOpportunity = {
      id: "http2",
      savings_ms: Math.round(http2Audit.numericValue || 0),
      resources: [],
    };

    const http2Details = http2Audit.details as any;
    if (
      http2Details &&
      http2Details.items &&
      Array.isArray(http2Details.items)
    ) {
      http2Details.items.forEach((item: { url?: string }) => {
        if (item.url) {
          // Extract file name from full URL
          const fileName = item.url.split("/").pop() || item.url;
          opportunity.resources.push({ url: fileName });
        }
      });
    }

    if (opportunity.resources.length > 0) {
      opportunities.push(opportunity);
    }
  }

  // After extracting all metrics and opportunities, collect page stats
  // Extract page stats
  let page_stats: AIPageStats | undefined;

  // Total page stats
  const totalByteWeight = audits["total-byte-weight"];
  const networkRequests = audits["network-requests"];
  const thirdPartyAudit = audits["third-party-summary"];
  const mainThreadWork = audits["mainthread-work-breakdown"];

  if (networkRequests && networkRequests.details) {
    const resourceDetails = networkRequests.details as any;

    if (resourceDetails.items && Array.isArray(resourceDetails.items)) {
      const resources = resourceDetails.items;
      const totalRequests = resources.length;

      // Calculate total size and counts by type
      let totalSizeKb = 0;
      let jsCount = 0,
        cssCount = 0,
        imgCount = 0,
        fontCount = 0,
        otherCount = 0;

      resources.forEach((resource: any) => {
        const sizeKb = resource.transferSize
          ? Math.round(resource.transferSize / 1024)
          : 0;
        totalSizeKb += sizeKb;

        // Count by mime type
        const mimeType = resource.mimeType || "";
        if (mimeType.includes("javascript") || resource.url.endsWith(".js")) {
          jsCount++;
        } else if (mimeType.includes("css") || resource.url.endsWith(".css")) {
          cssCount++;
        } else if (
          mimeType.includes("image") ||
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(resource.url)
        ) {
          imgCount++;
        } else if (
          mimeType.includes("font") ||
          /\.(woff|woff2|ttf|otf|eot)$/i.test(resource.url)
        ) {
          fontCount++;
        } else {
          otherCount++;
        }
      });

      // Calculate third-party size
      let thirdPartySizeKb = 0;
      if (thirdPartyAudit && thirdPartyAudit.details) {
        const thirdPartyDetails = thirdPartyAudit.details as any;
        if (thirdPartyDetails.items && Array.isArray(thirdPartyDetails.items)) {
          thirdPartyDetails.items.forEach((item: any) => {
            if (item.transferSize) {
              thirdPartySizeKb += Math.round(item.transferSize / 1024);
            }
          });
        }
      }

      // Get main thread blocking time
      let mainThreadBlockingTimeMs = 0;
      if (mainThreadWork && mainThreadWork.numericValue) {
        mainThreadBlockingTimeMs = Math.round(mainThreadWork.numericValue);
      }

      // Create page stats object
      page_stats = {
        total_size_kb: totalSizeKb,
        total_requests: totalRequests,
        resource_counts: {
          js: jsCount,
          css: cssCount,
          img: imgCount,
          font: fontCount,
          other: otherCount,
        },
        third_party_size_kb: thirdPartySizeKb,
        main_thread_blocking_time_ms: mainThreadBlockingTimeMs,
      };
    }
  }

  // Generate prioritized recommendations
  const prioritized_recommendations: string[] = [];

  // Add key recommendations based on failed audits with high impact
  if (
    audits["render-blocking-resources"] &&
    audits["render-blocking-resources"].score !== null &&
    audits["render-blocking-resources"].score === 0
  ) {
    prioritized_recommendations.push("Eliminate render-blocking resources");
  }

  if (
    audits["uses-responsive-images"] &&
    audits["uses-responsive-images"].score !== null &&
    audits["uses-responsive-images"].score === 0
  ) {
    prioritized_recommendations.push("Properly size images");
  }

  if (
    audits["uses-optimized-images"] &&
    audits["uses-optimized-images"].score !== null &&
    audits["uses-optimized-images"].score === 0
  ) {
    prioritized_recommendations.push("Efficiently encode images");
  }

  if (
    audits["uses-text-compression"] &&
    audits["uses-text-compression"].score !== null &&
    audits["uses-text-compression"].score === 0
  ) {
    prioritized_recommendations.push("Enable text compression");
  }

  if (
    audits["uses-http2"] &&
    audits["uses-http2"].score !== null &&
    audits["uses-http2"].score === 0
  ) {
    prioritized_recommendations.push("Use HTTP/2");
  }

  // Add more specific recommendations based on Core Web Vitals
  if (
    audits["largest-contentful-paint"] &&
    audits["largest-contentful-paint"].score !== null &&
    audits["largest-contentful-paint"].score < 0.5
  ) {
    prioritized_recommendations.push("Improve Largest Contentful Paint (LCP)");
  }

  if (
    audits["cumulative-layout-shift"] &&
    audits["cumulative-layout-shift"].score !== null &&
    audits["cumulative-layout-shift"].score < 0.5
  ) {
    prioritized_recommendations.push("Reduce layout shifts (CLS)");
  }

  if (
    audits["total-blocking-time"] &&
    audits["total-blocking-time"].score !== null &&
    audits["total-blocking-time"].score < 0.5
  ) {
    prioritized_recommendations.push("Reduce JavaScript execution time");
  }

  // Add to the return object
  return {
    metadata,
    score,
    audit_counts,
    metrics,
    opportunities,
    page_stats,
    prioritized_recommendations:
      prioritized_recommendations.length > 0
        ? prioritized_recommendations
        : undefined,
  };
};
