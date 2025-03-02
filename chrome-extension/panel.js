// Store settings
let settings = {
  logLimit: 50,
  queryLimit: 30000,
  stringSizeLimit: 500,
  showRequestHeaders: false,
  showResponseHeaders: false,
  maxLogSize: 20000,
  screenshotPath: "",
  // Add server connection settings
  serverHost: "localhost",
  serverPort: 3025,
};

// Load saved settings on startup
chrome.storage.local.get(["browserConnectorSettings"], (result) => {
  if (result.browserConnectorSettings) {
    settings = { ...settings, ...result.browserConnectorSettings };
    updateUIFromSettings();
  }
});

// Initialize UI elements
const logLimitInput = document.getElementById("log-limit");
const queryLimitInput = document.getElementById("query-limit");
const stringSizeLimitInput = document.getElementById("string-size-limit");
const showRequestHeadersCheckbox = document.getElementById(
  "show-request-headers"
);
const showResponseHeadersCheckbox = document.getElementById(
  "show-response-headers"
);
const maxLogSizeInput = document.getElementById("max-log-size");
const screenshotPathInput = document.getElementById("screenshot-path");
const captureScreenshotButton = document.getElementById("capture-screenshot");

// Server connection UI elements
const serverHostInput = document.getElementById("server-host");
const serverPortInput = document.getElementById("server-port");
const discoverServerButton = document.getElementById("discover-server");
const testConnectionButton = document.getElementById("test-connection");
const connectionStatusDiv = document.getElementById("connection-status");
const statusIcon = document.getElementById("status-icon");
const statusText = document.getElementById("status-text");

// Initialize collapsible advanced settings
const advancedSettingsHeader = document.getElementById(
  "advanced-settings-header"
);
const advancedSettingsContent = document.getElementById(
  "advanced-settings-content"
);
const chevronIcon = advancedSettingsHeader.querySelector(".chevron");

advancedSettingsHeader.addEventListener("click", () => {
  advancedSettingsContent.classList.toggle("visible");
  chevronIcon.classList.toggle("open");
});

// Update UI from settings
function updateUIFromSettings() {
  logLimitInput.value = settings.logLimit;
  queryLimitInput.value = settings.queryLimit;
  stringSizeLimitInput.value = settings.stringSizeLimit;
  showRequestHeadersCheckbox.checked = settings.showRequestHeaders;
  showResponseHeadersCheckbox.checked = settings.showResponseHeaders;
  maxLogSizeInput.value = settings.maxLogSize;
  screenshotPathInput.value = settings.screenshotPath;
  serverHostInput.value = settings.serverHost;
  serverPortInput.value = settings.serverPort;
}

// Save settings
function saveSettings() {
  chrome.storage.local.set({ browserConnectorSettings: settings });
  // Notify devtools.js about settings change
  chrome.runtime.sendMessage({
    type: "SETTINGS_UPDATED",
    settings,
  });
}

// Add event listeners for all inputs
logLimitInput.addEventListener("change", (e) => {
  settings.logLimit = parseInt(e.target.value, 10);
  saveSettings();
});

queryLimitInput.addEventListener("change", (e) => {
  settings.queryLimit = parseInt(e.target.value, 10);
  saveSettings();
});

stringSizeLimitInput.addEventListener("change", (e) => {
  settings.stringSizeLimit = parseInt(e.target.value, 10);
  saveSettings();
});

showRequestHeadersCheckbox.addEventListener("change", (e) => {
  settings.showRequestHeaders = e.target.checked;
  saveSettings();
});

showResponseHeadersCheckbox.addEventListener("change", (e) => {
  settings.showResponseHeaders = e.target.checked;
  saveSettings();
});

maxLogSizeInput.addEventListener("change", (e) => {
  settings.maxLogSize = parseInt(e.target.value, 10);
  saveSettings();
});

screenshotPathInput.addEventListener("change", (e) => {
  settings.screenshotPath = e.target.value;
  saveSettings();
});

// Add event listeners for server settings
serverHostInput.addEventListener("change", (e) => {
  settings.serverHost = e.target.value;
  saveSettings();
});

serverPortInput.addEventListener("change", (e) => {
  settings.serverPort = parseInt(e.target.value, 10);
  saveSettings();
});

// Test server connection
testConnectionButton.addEventListener("click", async () => {
  await testConnection(settings.serverHost, settings.serverPort);
});

// Function to test server connection
async function testConnection(host, port) {
  connectionStatusDiv.style.display = "block";
  statusIcon.className = "status-indicator";
  statusText.textContent = "Testing connection...";

  try {
    // Use the identity endpoint instead of .port for more reliable validation
    const response = await fetch(`http://${host}:${port}/.identity`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      const identity = await response.json();

      // Verify this is actually our server by checking the signature
      if (identity.signature !== "mcp-browser-connector-24x7") {
        statusIcon.className = "status-indicator status-disconnected";
        statusText.textContent = `Connection failed: Found a server at ${host}:${port} but it's not the Browser Tools server`;
        return;
      }

      statusIcon.className = "status-indicator status-connected";
      statusText.textContent = `Connected successfully to ${identity.name} v${identity.version} at ${host}:${port}`;

      // Update settings if different port was discovered
      if (parseInt(identity.port, 10) !== port) {
        console.log(`Detected different port: ${identity.port}`);
        settings.serverPort = parseInt(identity.port, 10);
        serverPortInput.value = settings.serverPort;
        saveSettings();
      }
    } else {
      statusIcon.className = "status-indicator status-disconnected";
      statusText.textContent = `Connection failed: Server returned ${response.status}`;
    }
  } catch (error) {
    statusIcon.className = "status-indicator status-disconnected";
    statusText.textContent = `Connection failed: ${error.message}`;
  }
}

// Server discovery function
discoverServerButton.addEventListener("click", async () => {
  connectionStatusDiv.style.display = "block";
  statusIcon.className = "status-indicator";
  statusText.textContent = "Discovering server...";

  // Common IPs to try
  const hosts = ["localhost", "127.0.0.1", "0.0.0.0"];

  // Get local IP addresses on common networks
  const commonLocalIps = ["192.168.0.", "192.168.1.", "10.0.0.", "10.0.1."];

  // Add common local networks with last octet from 1 to 10
  for (const prefix of commonLocalIps) {
    for (let i = 1; i <= 10; i++) {
      hosts.push(`${prefix}${i}`);
    }
  }

  // Common ports to try
  const ports = [3025, parseInt(settings.serverPort, 10)];

  // Ensure the current port is in the list
  if (!ports.includes(parseInt(settings.serverPort, 10))) {
    ports.push(parseInt(settings.serverPort, 10));
  }

  // Create a progress indicator
  let progress = 0;
  const totalAttempts = hosts.length * ports.length;
  statusText.textContent = `Discovering server... (0/${totalAttempts})`;

  // Try each host:port combination
  for (const host of hosts) {
    for (const port of ports) {
      try {
        // Skip duplicates if current port is in the ports list multiple times
        if (
          port === parseInt(settings.serverPort, 10) &&
          host === settings.serverHost
        ) {
          progress++;
          statusText.textContent = `Discovering server... (${progress}/${totalAttempts})`;
          continue;
        }

        // Update progress
        progress++;
        statusText.textContent = `Discovering server... (${progress}/${totalAttempts}) - Trying ${host}:${port}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout per attempt

        // Use identity endpoint instead of .port for more reliable server validation
        const response = await fetch(`http://${host}:${port}/.identity`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const identity = await response.json();

          // Verify this is actually our server by checking the signature
          if (identity.signature !== "mcp-browser-connector-24x7") {
            console.log(
              `Found a server at ${host}:${port} but it's not the Browser Tools server`
            );
            continue;
          }

          // Update settings with discovered server
          settings.serverHost = host;
          settings.serverPort = parseInt(identity.port, 10);
          serverHostInput.value = settings.serverHost;
          serverPortInput.value = settings.serverPort;
          saveSettings();

          statusIcon.className = "status-indicator status-connected";
          statusText.textContent = `Discovered ${identity.name} v${identity.version} at ${host}:${identity.port}`;

          // Stop searching once found
          return;
        }
      } catch (error) {
        // Ignore connection errors during discovery
      }
    }
  }

  // If we get here, no server was found
  statusIcon.className = "status-indicator status-disconnected";
  statusText.textContent =
    "No server found. Please check server is running and try again.";
});

// Screenshot capture functionality
captureScreenshotButton.addEventListener("click", () => {
  captureScreenshotButton.textContent = "Capturing...";

  // Send message to background script to capture screenshot
  chrome.runtime.sendMessage(
    {
      type: "CAPTURE_SCREENSHOT",
      tabId: chrome.devtools.inspectedWindow.tabId,
      screenshotPath: settings.screenshotPath,
    },
    (response) => {
      console.log("Screenshot capture response:", response);
      if (!response) {
        captureScreenshotButton.textContent = "Failed to capture!";
        console.error("Screenshot capture failed: No response received");
      } else if (!response.success) {
        captureScreenshotButton.textContent = "Failed to capture!";
        console.error("Screenshot capture failed:", response.error);
      } else {
        captureScreenshotButton.textContent = `Captured: ${response.title}`;
        console.log("Screenshot captured successfully:", response.path);
      }
      setTimeout(() => {
        captureScreenshotButton.textContent = "Capture Screenshot";
      }, 2000);
    }
  );
});

// Add wipe logs functionality
const wipeLogsButton = document.getElementById("wipe-logs");
wipeLogsButton.addEventListener("click", () => {
  const serverUrl = `http://${settings.serverHost}:${settings.serverPort}/wipelogs`;
  console.log(`Sending wipe request to ${serverUrl}`);

  fetch(serverUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then((response) => response.json())
    .then((result) => {
      console.log("Logs wiped successfully:", result.message);
      wipeLogsButton.textContent = "Logs Wiped!";
      setTimeout(() => {
        wipeLogsButton.textContent = "Wipe All Logs";
      }, 2000);
    })
    .catch((error) => {
      console.error("Failed to wipe logs:", error);
      wipeLogsButton.textContent = "Failed to Wipe Logs";
      setTimeout(() => {
        wipeLogsButton.textContent = "Wipe All Logs";
      }, 2000);
    });
});
