import fs from "fs";
import fetch from "node-fetch";
import puppeteer from "puppeteer-core";
import { spawn } from "child_process";
import path from "path";
import os from "os";

// Global variable to store the launched browser's WebSocket endpoint
let launchedBrowserWSEndpoint: string | null = null;

// Global variable to store the browser instance for reuse
let headlessBrowserInstance: puppeteer.Browser | null = null;

// Add a timeout variable to track browser cleanup
let browserCleanupTimeout: NodeJS.Timeout | null = null;
// Default timeout in milliseconds before closing the browser
const BROWSER_CLEANUP_TIMEOUT = 60000; // 60 seconds

/**
 * Finds the path to an installed browser (Chrome or Edge)
 * @returns Promise resolving to the path of the browser executable
 * @throws Error if no compatible browser is found
 */
export async function findBrowserExecutablePath(): Promise<string> {
  const platform = process.platform;

  if (platform === "darwin") {
    // Check for Edge first on macOS
    if (fs.existsSync("/Applications/Microsoft Edge.app")) {
      return "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
    }
    // Fallback to Chrome
    if (fs.existsSync("/Applications/Google Chrome.app")) {
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    }
  } else if (platform === "win32") {
    // Check for Edge first on Windows
    if (
      fs.existsSync(
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
      )
    ) {
      return "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
    }
    // Fallback to Chrome
    if (
      fs.existsSync(
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      )
    ) {
      return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    }
  }

  throw new Error(
    "No compatible browser found. Please install Microsoft Edge or Google Chrome."
  );
}

/**
 * Gets the WebSocket debugger URL for a running Chrome/Edge instance
 * @returns Promise resolving to the WebSocket URL
 * @throws Error if no debugging browser is found
 */
export async function getDebuggerWebSocketUrl(): Promise<string> {
  console.log("Attempting to get debugger WebSocket URL...");

  try {
    // Try Chrome first
    try {
      console.log("Attempting to connect to Chrome on port 9222...");
      // Attempt to connect to Chrome on port 9222 using IPv4 explicitly
      const response = await fetch("http://127.0.0.1:9222/json/version");
      if (response.ok) {
        const data = await response.json();
        console.log(
          "Successfully connected to Chrome:",
          data.webSocketDebuggerUrl
        );
        return data.webSocketDebuggerUrl;
      } else {
        console.log("Chrome connection response not OK:", response.status);
      }
    } catch (error) {
      // More detailed error logging
      console.log(
        "Failed to connect to Chrome:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Try Edge next (it often uses port 9222 as well)
    try {
      console.log("Attempting to connect to Edge on port 9222...");
      const response = await fetch("http://127.0.0.1:9222/json/version");
      if (response.ok) {
        const data = await response.json();
        console.log(
          "Successfully connected to Edge:",
          data.webSocketDebuggerUrl
        );
        return data.webSocketDebuggerUrl;
      } else {
        console.log("Edge connection response not OK:", response.status);
      }
    } catch (error) {
      // More detailed error logging
      console.log(
        "Failed to connect to Edge:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Try alternative ports
    const alternativePorts = [9223, 9224, 9225];
    for (const port of alternativePorts) {
      try {
        console.log(`Attempting to connect on alternative port ${port}...`);
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (response.ok) {
          const data = await response.json();
          console.log(
            `Successfully connected on port ${port}:`,
            data.webSocketDebuggerUrl
          );
          return data.webSocketDebuggerUrl;
        }
      } catch (error) {
        console.log(
          `Failed to connect on port ${port}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    throw new Error("No debugging browser found on any port");
  } catch (error) {
    console.error(
      "Error getting debugger WebSocket URL:",
      error instanceof Error ? error.message : String(error)
    );
    throw new Error(
      "Ensure a browser (Chrome or Edge) is running with --remote-debugging-port=9222"
    );
  }
}

/**
 * Launches a new browser instance with remote debugging enabled
 * @returns Promise resolving to the port number the browser is running on
 * @throws Error if unable to launch browser
 */
export async function launchBrowserWithDebugging(): Promise<number> {
  console.log("Attempting to launch a new browser with debugging enabled...");
  try {
    // Use the singleton browser instance
    const browser = await getHeadlessBrowserInstance();

    if (!launchedBrowserWSEndpoint) {
      throw new Error("Failed to retrieve WebSocket endpoint for browser");
    }

    // Extract port from WebSocket endpoint
    const port = parseInt(
      launchedBrowserWSEndpoint.split(":")[2].split("/")[0]
    );

    console.log(
      `Browser launched with WebSocket endpoint: ${launchedBrowserWSEndpoint}, port: ${port}`
    );

    // Test browser responsiveness
    try {
      console.log("Testing browser responsiveness...");
      const page = await browser.newPage();
      await page.goto("about:blank");
      console.log("Browser is responsive and ready");
      return port;
    } catch (pageError: any) {
      console.error("Failed to create page in browser:", pageError);
      throw new Error(
        `Browser launched but is unresponsive: ${pageError.message}`
      );
    }
  } catch (error) {
    console.error("Failed to launch browser:", error);
    throw new Error(
      `Failed to launch browser: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Function to get the singleton browser instance
async function getHeadlessBrowserInstance(): Promise<puppeteer.Browser> {
  console.log("Browser instance request started");

  // Clear any existing cleanup timeout when a new request comes in
  if (browserCleanupTimeout) {
    console.log("Cancelling scheduled browser cleanup");
    clearTimeout(browserCleanupTimeout);
    browserCleanupTimeout = null;
  }

  if (headlessBrowserInstance && launchedBrowserWSEndpoint) {
    try {
      // Check if the browser is still connected
      const pages = await headlessBrowserInstance.pages();
      console.log(
        `Reusing existing headless browser with ${pages.length} pages`
      );
      return headlessBrowserInstance;
    } catch (error) {
      console.log(
        "Existing browser instance is no longer valid, creating a new one"
      );
      headlessBrowserInstance = null;
      launchedBrowserWSEndpoint = null;
    }
  }

  // Launch a new browser
  console.log("Creating new headless browser instance");
  const browserPath = await findBrowserExecutablePath();

  // Create a unique temporary user data directory
  const tempDir = os.tmpdir();
  const uniqueId = `${Date.now().toString()}-${Math.random()
    .toString(36)
    .substring(2)}`;
  const userDataDir = path.join(tempDir, `browser-debug-profile-${uniqueId}`);
  fs.mkdirSync(userDataDir, { recursive: true });
  console.log(`Using temporary user data directory: ${userDataDir}`);

  // Launch browser with puppeteer using dynamic port
  console.log("Launching browser with puppeteer in headless mode...");
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    args: [
      "--remote-debugging-port=0", // Use dynamic port
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-dev-shm-usage", // Helps with memory issues in Docker
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--disable-background-networking",
      "--disable-backgrounding-occluded-windows",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--no-pings",
      "--safebrowsing-disable-auto-update",
    ],
    headless: true,
  });

  // Store the WebSocket endpoint
  launchedBrowserWSEndpoint = browser.wsEndpoint();
  headlessBrowserInstance = browser;

  // Optional cleanup: Remove directory when browser closes
  browser.on("disconnected", () => {
    console.log(`Cleaning up temporary directory: ${userDataDir}`);
    fs.rmSync(userDataDir, { recursive: true, force: true });
    launchedBrowserWSEndpoint = null;
    headlessBrowserInstance = null;

    // Clear any existing cleanup timeout when browser is disconnected
    if (browserCleanupTimeout) {
      clearTimeout(browserCleanupTimeout);
      browserCleanupTimeout = null;
    }
  });

  console.log("Browser ready");
  return browser;
}

/**
 * Connects to a headless browser specifically for audits
 * This function skips all attempts to connect to existing browsers and always launches a new headless browser
 * @param url The URL to navigate to
 * @param options Options for the audit
 * @returns Promise resolving to the browser instance and port
 */
export async function connectToHeadlessBrowser(
  url: string,
  options: {
    blockResources?: boolean;
  } = {}
): Promise<{
  browser: puppeteer.Browser;
  port: number;
  page: puppeteer.Page;
}> {
  console.log(
    `Connecting to headless browser for audit${
      options.blockResources ? " (blocking non-essential resources)" : ""
    }`
  );

  try {
    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL format: ${url}`);
    }

    // Get or create a browser instance
    const browser = await getHeadlessBrowserInstance();

    if (!launchedBrowserWSEndpoint) {
      throw new Error("Failed to retrieve WebSocket endpoint for browser");
    }

    // Extract port from WebSocket endpoint
    const port = parseInt(
      launchedBrowserWSEndpoint.split(":")[2].split("/")[0]
    );

    // Always create a new page for each audit to avoid request interception conflicts
    console.log("Creating a new page for this audit");
    const page = await browser.newPage();

    // Set a longer timeout for navigation
    page.setDefaultNavigationTimeout(60000); // 60 seconds

    // Check if we should block resources based on the options
    if (options.blockResources) {
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        // Block unnecessary resources to speed up loading
        const resourceType = request.resourceType();
        if (
          resourceType === "image" ||
          resourceType === "font" ||
          resourceType === "media"
        ) {
          request.abort();
        } else {
          request.continue();
        }
      });
    }

    // Navigate to the URL with more flexible options
    try {
      // First try with domcontentloaded which is faster
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000, // 30 seconds
      });
    } catch (navError: any) {
      console.warn(
        `Navigation with domcontentloaded failed: ${navError.message}, trying with load event...`
      );

      // If that fails, try with just load event
      try {
        await page.goto(url, {
          waitUntil: "load",
          timeout: 45000, // 45 seconds
        });
      } catch (loadError: any) {
        console.error(
          `Navigation with load event also failed: ${loadError.message}`
        );
        throw loadError; // Re-throw the error
      }
    }

    return { browser, port, page };
  } catch (error) {
    console.error("Failed to connect to headless browser:", error);
    throw new Error(
      `Failed to connect to headless browser: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Schedule browser cleanup after a delay
 * This allows the browser to be reused for subsequent audits within the timeout period
 */
export function scheduleBrowserCleanup(): void {
  // Clear any existing timeout first
  if (browserCleanupTimeout) {
    clearTimeout(browserCleanupTimeout);
  }

  // Only schedule cleanup if we have an active browser instance
  if (headlessBrowserInstance) {
    console.log(
      `Scheduling browser cleanup in ${BROWSER_CLEANUP_TIMEOUT / 1000} seconds`
    );

    browserCleanupTimeout = setTimeout(() => {
      console.log("Executing scheduled browser cleanup");
      if (headlessBrowserInstance) {
        console.log("Closing headless browser instance");
        headlessBrowserInstance.close();
        headlessBrowserInstance = null;
        launchedBrowserWSEndpoint = null;
      }
      browserCleanupTimeout = null;
    }, BROWSER_CLEANUP_TIMEOUT);
  }
}
