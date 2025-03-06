# Browser Tools Server

A powerful browser tools server for capturing and managing browser events, logs, and screenshots. This server works in conjunction with the Browser Tools Chrome Extension to provide comprehensive browser debugging capabilities.

## Features

- Console log capture
- Network request monitoring
- Screenshot capture
- Element selection tracking
- WebSocket real-time communication
- Configurable log limits and settings
- Lighthouse-powered accessibility and performance audits

## Prerequisites

- Node.js 14 or higher
- Chrome or Chromium browser installed (required for audit functionality)

## Installation

```bash
npx @agentdeskai/browser-tools-server
```

Or install globally:

```bash
npm install -g @agentdeskai/browser-tools-server
```

## Usage

1. Start the server:

```bash
npx @agentdeskai/browser-tools-server
```

2. The server will start on port 3025 by default

3. Install and enable the Browser Tools Chrome Extension

4. The server exposes the following endpoints:

- `/console-logs` - Get console logs
- `/console-errors` - Get console errors
- `/network-errors` - Get network error logs
- `/network-success` - Get successful network requests
- `/all-xhr` - Get all network requests
- `/screenshot` - Capture screenshots
- `/selected-element` - Get currently selected DOM element
- `/accessibility-audit` - Run accessibility audit on current page
- `/performance-audit` - Run performance audit on current page
- `/seo-audit` - Run SEO audit on current page

## API Documentation

### GET Endpoints

- `GET /console-logs` - Returns recent console logs
- `GET /console-errors` - Returns recent console errors
- `GET /network-errors` - Returns recent network errors
- `GET /network-success` - Returns recent successful network requests
- `GET /all-xhr` - Returns all recent network requests
- `GET /selected-element` - Returns the currently selected DOM element

### POST Endpoints

- `POST /extension-log` - Receive logs from the extension
- `POST /screenshot` - Capture and save screenshots
- `POST /selected-element` - Update the selected element
- `POST /wipelogs` - Clear all stored logs
- `POST /accessibility-audit` - Run a WCAG-compliant accessibility audit on the current page
- `POST /performance-audit` - Run a performance audit on the current page
- `POST /seo-audit` - Run a SEO audit on the current page

## Audit Functionality

The server provides Lighthouse-powered audit capabilities for accessibility and performance testing:

### Accessibility Audit

Runs a WCAG-compliant accessibility audit on the current page. The audit checks for common accessibility issues such as:

- Color contrast problems
- Missing alt text on images
- Keyboard navigation issues
- ARIA attribute problems
- Form label issues

### Performance Audit

Runs a performance audit on the current page to identify issues affecting load speed and responsiveness:

- Render-blocking resources
- Excessive DOM size
- Unoptimized images
- JavaScript execution time
- First Contentful Paint (FCP) and other metrics

## License

MIT

# Puppeteer Service

A comprehensive browser automation service built on Puppeteer to provide reliable cross-platform browser control capabilities.

## Features

- **Cross-Platform Browser Support**:

  - Windows, macOS, and Linux support
  - Chrome, Edge, Brave, and Firefox detection
  - Fallback strategy for finding browser executables

- **Smart Browser Management**:

  - Singleton browser instance with automatic cleanup
  - Connection retry mechanisms
  - Temporary user data directories with cleanup

- **Rich Configuration Options**:
  - Custom browser paths
  - Network condition emulation
  - Device emulation (mobile, tablet, desktop)
  - Resource blocking
  - Cookies and headers customization
  - Locale and timezone emulation
