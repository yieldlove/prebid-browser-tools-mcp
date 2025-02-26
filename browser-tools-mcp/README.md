# Browser Tools MCP Server

A Model Context Protocol (MCP) server that provides AI-powered browser tools integration. This server works in conjunction with the Browser Tools Server to provide AI capabilities for browser debugging and analysis.

## Features

- MCP protocol implementation
- Browser console log access
- Network request analysis
- Screenshot capture capabilities
- Element selection and inspection
- Real-time browser state monitoring
- Accessibility and performance audits

## Prerequisites

- Node.js 14 or higher
- Browser Tools Server running
- Chrome or Chromium browser installed (required for audit functionality)

## Installation

```bash
npx @agentdeskai/browser-tools-mcp
```

Or install globally:

```bash
npm install -g @agentdeskai/browser-tools-mcp
```

## Usage

1. First, make sure the Browser Tools Server is running:

```bash
npx @agentdeskai/browser-tools-server
```

2. Then start the MCP server:

```bash
npx @agentdeskai/browser-tools-mcp
```

3. The MCP server will connect to the Browser Tools Server and provide the following capabilities:

- Console log retrieval
- Network request monitoring
- Screenshot capture
- Element selection
- Browser state analysis
- Accessibility and performance audits

## MCP Functions

The server provides the following MCP functions:

- `mcp_getConsoleLogs` - Retrieve browser console logs
- `mcp_getConsoleErrors` - Get browser console errors
- `mcp_getNetworkErrors` - Get network error logs
- `mcp_getNetworkSuccess` - Get successful network requests
- `mcp_getNetworkLogs` - Get all network logs
- `mcp_getSelectedElement` - Get the currently selected DOM element
- `mcp_runAccessibilityAudit` - Run a WCAG-compliant accessibility audit
- `mcp_runPerformanceAudit` - Run a performance audit

## Audit Functionality

The MCP server provides Lighthouse-powered audit capabilities through two main functions:

### Accessibility Audit

The `mcp_runAccessibilityAudit` function runs a WCAG-compliant accessibility audit on the current page. It returns:

- An overall accessibility score (0-100)
- A list of accessibility issues sorted by impact level (critical, serious, moderate, minor)
- Detailed information about each issue including:
  - Affected elements (with selectors and snippets)
  - WCAG reference information
  - Recommendations for fixing the issues

Example output:

```json
{
  "score": 78,
  "categoryScores": {
    "accessibility": 78
  },
  "issues": [
    {
      "id": "color-contrast",
      "title": "Background and foreground colors do not have a sufficient contrast ratio",
      "description": "Low-contrast text is difficult or impossible for many users to read.",
      "score": 0,
      "impact": "serious",
      "elements": [
        {
          "selector": ".nav-link",
          "snippet": "<a class=\"nav-link\">Home</a>",
          "explanation": "Element has insufficient color contrast of 2.5:1"
        }
      ],
      "failureSummary": "Fix any of the following: Element has insufficient color contrast of 2.5:1 (foreground color: #888888, background color: #ffffff, font size: 12.0pt, font weight: normal)"
    }
  ]
}
```

### Performance Audit

The `mcp_runPerformanceAudit` function runs a performance audit on the current page. It returns:

- An overall performance score (0-100)
- A list of performance issues sorted by impact on page load time
- Detailed information about each issue including:
  - Affected resources
  - Wasted bytes and milliseconds
  - Recommendations for improving performance

Example output:

```json
{
  "score": 65,
  "categoryScores": {
    "performance": 65
  },
  "issues": [
    {
      "id": "render-blocking-resources",
      "title": "Eliminate render-blocking resources",
      "description": "Resources are blocking the first paint of your page.",
      "score": 0.4,
      "impact": "serious",
      "elements": [
        {
          "url": "https://example.com/styles.css",
          "wastedMs": 350,
          "wastedBytes": 45000
        }
      ],
      "failureSummary": "Consider delivering critical JS/CSS inline and deferring all non-critical JS/styles."
    }
  ]
}
```

## Integration

This server is designed to work with AI tools and platforms that support the Model Context Protocol (MCP). It provides a standardized interface for AI models to interact with browser state and debugging information.

## License

MIT
