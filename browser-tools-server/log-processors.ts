// Log processors and truncators for browser-tools-server

// Truncator: filter logs for Prebid/yieldlove messages only
export function truncateForPrebidLogs(logs: any[]): any[] {
  if (logs.length === 0) return logs;
  // Only include logs where the message contains 'prebid' or 'yieldlove' (case-insensitive)
  return logs.filter((log) => {
    if (!log.message || typeof log.message !== "string") return false;
    const msg = log.message.toLowerCase();
    return msg.includes("prebid") || msg.includes("yieldlove");
  });
}

// Truncator: remove inline CSS styles from log messages
export function truncateInlineCssStyles(logs: any[]): any[] {
  return logs.map((log) => {
    if (log.message && typeof log.message === "string") {
      let cleaned = log.message;
      // Remove a single leading %c at the start of the message
      cleaned = cleaned.replace(/^%c\s*/, "");
      // Only remove specific CSS key-value pairs
      cleaned = cleaned.replace(/\b(display|color|background|padding|border-radius)\s*:\s*[^;]+;/g, "");
      // Merge multiple spaces into one
      cleaned = cleaned.replace(/\s+/g, " ");
      cleaned = cleaned.trim();
      return { ...log, message: cleaned };
    }
    return { ...log };
  });
}

// Truncator: remove 'type' field from each log
export function removeTypeField(logs: any[]): any[] {
  return logs.map((log) => {
    const { type, ...rest } = log;
    return { ...rest };
  });
}

// Truncator: remove 'level' field from each log
export function removeLevelField(logs: any[]): any[] {
  return logs.map((log) => {
    const { level, ...rest } = log;
    return { ...rest };
  });
}

// Truncator: convert 'timestamp' to 'time' in mm:ss.milliseconds
export function convertTimestampToTime(logs: any[]): any[] {
  return logs.map((log) => {
    if ('timestamp' in log) {
      const date = new Date(log.timestamp);
      const pad = (n: number, z = 2) => ("00" + n).slice(-z);
      const time =
        pad(date.getMinutes()) +
        ":" +
        pad(date.getSeconds()) +
        "." +
        pad(date.getMilliseconds(), 3);
      const { timestamp, ...rest } = log;
      return { ...rest, time };
    }
    return { ...log };
  });
}

// Truncator: rename 'message' to 'msg'
export function shortenMessageField(logs: any[]): any[] {
  return logs.map((log) => {
    if ('message' in log) {
      const { message, ...rest } = log;
      return { ...rest, msg: message };
    }
    return { ...log };
  });
} 