# Browser Context Provider (MCP Chrome Extension)

## Overview

This application is a powerful browser monitoring and interaction tool that enables AI-powered applications to capture and analyze browser data through a Chrome extension. It consists of three main components working together in a layered architecture:

1. **Chrome Extension**: A browser extension that captures console logs, network activity, and DOM elements.
2. **Node Server**: An intermediary server that facilitates communication between the Chrome extension and the MCP server.
3. **MCP Server**: A Model Context Protocol server that provides standardized tools for AI clients to interact with the browser.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────────┐
│  MCP Client │ ──► │  MCP Server  │ ──► │  Node Server  │ ──► │   Chrome    │
│  (e.g.      │ ◄── │  (Protocol   │ ◄── │ (Middleware)  │ ◄── │  Extension  │
│   Cursor)   │     │   Handler)   │     │               │     │             │
└─────────────┘     └──────────────┘     └───────────────┘     └─────────────┘
```

### Component Details

#### Chrome Extension

- Captures browser console logs
- Monitors network requests and responses
- Captures screenshots
- Tracks selected DOM elements
- Communicates with the Node server through DevTools protocol

#### Node Server

- Acts as middleware between the Chrome extension and MCP server
- Processes and routes requests
- Manages data transformation and communication

#### MCP Server

- Implements the Model Context Protocol
- Provides standardized tools for AI clients
- Interfaces with Anthropic Cloud LLM inference endpoints
- Compatible with various MCP clients (Cursor, etc.)

## Installation

### 1. MCP Server Setup

```bash
cd mcp-server
npm install
npm start
```

### 2. Chrome Extension Setup

1. Open your Chrome-based browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `chrome-extension` directory from this repository

### 3. MCP Client Configuration

Configure your MCP client with the following:

1. Command base: `node`
2. Server path: `[absolute_path_to_workspace]/mcp-server/dist/mcp-server.js`

## Features

- Console log capture
- Network request/response monitoring
- Screenshot capabilities
- DOM element selection
- Real-time browser state monitoring
- AI-powered analysis through LLM integration

## Usage

Once installed and configured, the system allows any compatible MCP client to:

- Monitor browser console output
- Capture network traffic
- Take screenshots
- Analyze selected elements
- Interface with AI models for enhanced functionality

## Compatibility

- Works with any MCP-compatible client
- Primarily designed for Cursor IDE integration
- Supports other AI editors and MCP clients

## Development

The application uses TypeScript for the server components and standard web technologies for the Chrome extension. Built files are generated in the `dist` directory upon running `npm start` in the MCP server.
