import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";

// Create the MCP server
const server = new McpServer({
  name: "AI Browser Connector",
  version: "1.0.0",
});

// Function to get the port from the .port file
function getPort(): number {
  try {
    const port = parseInt(fs.readFileSync(".port", "utf8"));
    return port;
  } catch (err) {
    console.error("Could not read port file, defaulting to 3000");
    return 3025;
  }
}

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
    const last50 = json.slice(-50);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(last50, null, 2),
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

// Return all XHR/fetch requests
server.tool("getNetworkSuccess", "Check our network SUCCESS logs", async () => {
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

// Start receiving messages on stdio
(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
