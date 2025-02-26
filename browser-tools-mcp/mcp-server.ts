#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// import { z } from "zod";
// import fs from "fs";

// Create the MCP server
const server = new McpServer({
  name: "Browsert Tools MCP",
  version: "1.0.9",
});

// Define audit categories as enum to match the server's AuditCategory enum
enum AuditCategory {
  ACCESSIBILITY = "accessibility",
  PERFORMANCE = "performance",
  SEO = "seo",
  BEST_PRACTICES = "best-practices",
  PWA = "pwa",
}

// Function to get the port from the .port file
// function getPort(): number {
//   try {
//     const port = parseInt(fs.readFileSync(".port", "utf8"));
//     return port;
//   } catch (err) {
//     console.error("Could not read port file, defaulting to 3000");
//     return 3025;
//   }
// }

// const PORT = getPort();

const PORT = 3025;

// We'll define four "tools" that retrieve data from the aggregator at localhost:3000

server.tool("getConsoleLogs", "Check our browser logs", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/console-logs`);
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2),
      },
    ],
  };
});

server.tool(
  "getConsoleErrors",
  "Check our browsers console errors",
  async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/console-errors`);
    const json = await response.json();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(json, null, 2),
        },
      ],
    };
  }
);

// Return all HTTP errors (4xx/5xx)
server.tool("getNetworkErrors", "Check our network ERROR logs", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/network-errors`);
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2),
      },
    ],
  };
});

// // Return all XHR/fetch requests
// server.tool("getNetworkSuccess", "Check our network SUCCESS logs", async () => {
//   const response = await fetch(`http://127.0.0.1:${PORT}/all-xhr`);
//   const json = await response.json();
//   return {
//     content: [
//       {
//         type: "text",
//         text: JSON.stringify(json, null, 2),
//       },
//     ],
//   };
// });

// Return all XHR/fetch requests
server.tool("getNetworkLogs", "Check ALL our network logs", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/all-xhr`);
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(json, null, 2),
      },
    ],
  };
});

// Add new tool for taking screenshots
server.tool(
  "takeScreenshot",
  "Take a screenshot of the current browser tab",
  async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:${PORT}/capture-screenshot`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        // const message = `Screenshot saved to: ${
        //   result.path
        // }\nFilename: ${path.basename(result.path)}`;
        return {
          content: [
            {
              type: "text",
              text: "Successfully saved screenshot",
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error taking screenshot: ${result.error}`,
            },
          ],
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to take screenshot: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Add new tool for getting selected element
server.tool(
  "getSelectedElement",
  "Get the selected element from the browser",
  async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/selected-element`);
    const json = await response.json();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(json, null, 2),
        },
      ],
    };
  }
);

// Add new tool for wiping logs
server.tool("wipeLogs", "Wipe all browser logs from memory", async () => {
  const response = await fetch(`http://127.0.0.1:${PORT}/wipelogs`, {
    method: "POST",
  });
  const json = await response.json();
  return {
    content: [
      {
        type: "text",
        text: json.message,
      },
    ],
  };
});

// Add tool for accessibility audits, launches a headless browser instance
server.tool(
  "runAccessibilityAudit",
  "Run a WCAG-compliant accessibility audit on the current page",
  {},
  async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:${PORT}/accessibility-audit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: AuditCategory.ACCESSIBILITY,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`
        );
      }

      const json = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(json, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error in accessibility audit:", errorMessage);
      return {
        content: [
          {
            type: "text",
            text: `Failed to run accessibility audit: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Add tool for performance audits, launches a headless browser instance
server.tool(
  "runPerformanceAudit",
  "Run a performance audit on the current page",
  {},

  async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:${PORT}/performance-audit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: AuditCategory.PERFORMANCE,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`
        );
      }

      const json = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(json, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error in performance audit:", errorMessage);
      return {
        content: [
          {
            type: "text",
            text: `Failed to run performance audit: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

// Start receiving messages on stdio
(async () => {
  try {
    const transport = new StdioServerTransport();

    // Ensure stdout is only used for JSON messages
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
      // Only allow JSON messages to pass through
      if (typeof chunk === "string" && !chunk.startsWith("{")) {
        return true; // Silently skip non-JSON messages
      }
      return originalStdoutWrite(chunk, encoding, callback);
    };

    await server.connect(transport);
  } catch (error) {
    console.error("Failed to initialize MCP server:", error);
    process.exit(1);
  }
})();
