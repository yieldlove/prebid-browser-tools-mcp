# BrowserTools MCP (Fork)

This fork of [BrowserTools MCP](https://github.com/AgentDeskAI/browser-tools-mcp) extends the original browser monitoring toolset with Lighthouse-powered accessibility, performance, and SEO audits, leveraging Puppeteer for headless browser control. 
## Key Additions
- **Accessibility Audits**: WCAG-compliant checks using Lighthouse.
- **Performance Audits**: Analyze page load and runtime efficiency.
- **SEO Audits**: Assess on-page SEO factors and suggest improvements.
- **Puppeteer Integration**: Enables reliable, headless browser audits.

### Using Audit Tools
The MCP server provides tools to run audits on the current page. Here are example queries you can use to trigger them:

- **Accessibility Audit** (`runAccessibilityAudit`):
  - "Are there any accessibility issues on this page?"
  - "Run an accessibility audit."
  - "Check if this page meets WCAG standards."
- **Performance Audit** (`runPerformanceAudit`):
  - "Why is this page loading so slowly?"
  - "Check the performance of this page."
  - "Run a performance audit."
- **SEO Audit** (`runSEOAudit`):
  - "How can I improve SEO for this page?"
  - "Run an SEO audit."
  - "Check SEO on this page."

## Quick Start

- Follow the [Browser Tools installation guide](https://browsertools.agentdesk.ai/installation)
- To try the new tools, make sure to stand in the current tab (that you want to scan) with the Browser tools extension active
