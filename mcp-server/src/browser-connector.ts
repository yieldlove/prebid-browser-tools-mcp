import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { tokenizeAndEstimateCost } from "llm-cost";

// We store logs in memory
const consoleLogs: any[] = [];
const consoleErrors: any[] = [];
const networkErrors: any[] = [];
const networkSuccess: any[] = [];
const allXhr: any[] = [];

// Add settings state
let currentSettings = {
  logLimit: 50,
  queryLimit: 30000,
  showRequestHeaders: false,
  showResponseHeaders: false,
  model: "claude-3-sonnet",
  stringSizeLimit: 500,
  maxLogSize: 20000,
};

const app = express();
const PORT = 3025;

app.use(cors());
app.use(bodyParser.json());

// Helper to recursively truncate strings in any data structure
function truncateStringsInData(data: any, maxLength: number): any {
  if (typeof data === "string") {
    return data.length > maxLength
      ? data.substring(0, maxLength) + "... (truncated)"
      : data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => truncateStringsInData(item, maxLength));
  }

  if (typeof data === "object" && data !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = truncateStringsInData(value, maxLength);
    }
    return result;
  }

  return data;
}

// Helper to safely parse and process JSON strings
function processJsonString(jsonString: string, maxLength: number): string {
  try {
    // Try to parse the string as JSON
    const parsed = JSON.parse(jsonString);
    // Process any strings within the parsed JSON
    const processed = truncateStringsInData(parsed, maxLength);
    // Stringify the processed data
    return JSON.stringify(processed);
  } catch (e) {
    // If it's not valid JSON, treat it as a regular string
    return truncateStringsInData(jsonString, maxLength);
  }
}

// Helper to process logs based on settings
function processLogsWithSettings(logs: any[]) {
  return logs.map((log) => {
    const processedLog = { ...log };

    if (log.type === "network-request") {
      // Handle headers visibility
      if (!currentSettings.showRequestHeaders) {
        delete processedLog.requestHeaders;
      }
      if (!currentSettings.showResponseHeaders) {
        delete processedLog.responseHeaders;
      }
    }

    return processedLog;
  });
}

// Helper to calculate size of a log entry
function calculateLogSize(log: any): number {
  return JSON.stringify(log).length;
}

// Helper to truncate logs based on character limit
function truncateLogsToQueryLimit(logs: any[]): any[] {
  if (logs.length === 0) return logs;

  // First process logs according to current settings
  const processedLogs = processLogsWithSettings(logs);

  let currentSize = 0;
  const result = [];

  for (const log of processedLogs) {
    const logSize = calculateLogSize(log);

    // Check if adding this log would exceed the limit
    if (currentSize + logSize > currentSettings.queryLimit) {
      console.log(
        `Reached query limit (${currentSize}/${currentSettings.queryLimit}), truncating logs`
      );
      break;
    }

    // Add log and update size
    result.push(log);
    currentSize += logSize;
    console.log(`Added log of size ${logSize}, total size now: ${currentSize}`);
  }

  return result;
}

// Endpoint for the extension to POST data
app.post("/extension-log", (req, res) => {
  const { data, settings } = req.body;

  // Update settings if provided
  if (settings) {
    currentSettings = {
      ...currentSettings,
      ...settings,
    };
  }

  console.log("Received log:", data);
  switch (data.type) {
    case "console-log":
      consoleLogs.push(data);
      if (consoleLogs.length > currentSettings.logLimit) consoleLogs.shift();
      break;
    case "console-error":
      consoleErrors.push(data);
      if (consoleErrors.length > currentSettings.logLimit)
        consoleErrors.shift();
      break;
    case "network-request":
      // Route network requests based on status code
      if (data.status >= 400) {
        networkErrors.push(data);
        if (networkErrors.length > currentSettings.logLimit)
          networkErrors.shift();
      } else {
        networkSuccess.push(data);
        if (networkSuccess.length > currentSettings.logLimit)
          networkSuccess.shift();
      }
      break;
  }
  res.json({ status: "ok" });
});

// Update GET endpoints to use the new function
app.get("/console-logs", (req, res) => {
  const truncatedLogs = truncateLogsToQueryLimit(consoleLogs);
  res.json(truncatedLogs);
});

app.get("/console-errors", (req, res) => {
  const truncatedLogs = truncateLogsToQueryLimit(consoleErrors);
  res.json(truncatedLogs);
});

app.get("/network-errors", (req, res) => {
  const truncatedLogs = truncateLogsToQueryLimit(networkErrors);
  res.json(truncatedLogs);
});

app.get("/network-success", (req, res) => {
  const truncatedLogs = truncateLogsToQueryLimit(networkSuccess);
  res.json(truncatedLogs);
});

app.get("/all-xhr", (req, res) => {
  // Merge and sort network success and error logs by timestamp
  const mergedLogs = [...networkSuccess, ...networkErrors].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const truncatedLogs = truncateLogsToQueryLimit(mergedLogs);
  res.json(truncatedLogs);
});

app.get("/.port", (req, res) => {
  res.send(PORT.toString());
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Aggregator listening on http://127.0.0.1:${PORT}`);

  // Write the port to a file so mcp-server can read it
  const fs = require("fs");
  fs.writeFileSync(".port", PORT.toString());
});

// Handle shutdown gracefully
process.on("SIGINT", () => {
  server.close(() => {
    console.log("Server shut down");
    process.exit(0);
  });
});
