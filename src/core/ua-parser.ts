import { DeviceType, ParsedClientInfo } from "./types";

/**
 * Extracts the real client IP address from various standard HTTP proxy headers
 */
export function extractClientIp(headersSource: Request | Headers | Record<string, string | string[] | undefined>): string {
  let headers: { get: (key: string) => string | null };

  if (headersSource instanceof Request) {
    headers = headersSource.headers;
  } else if (typeof (headersSource as Headers).get === "function") {
    headers = headersSource as Headers;
  } else {
    // Record / plain object fallback
    const record = headersSource as Record<string, string | string[] | undefined>;
    headers = {
      get: (key: string) => {
        const val = record[key.toLowerCase()] || record[key];
        if (Array.isArray(val)) return val[0] || null;
        return val || null;
      },
    };
  }

  // Common proxy / CDN headers in order of preference
  const headerKeys = [
    "cf-connecting-ip", // Cloudflare
    "x-real-ip",        // Nginx / general reverse proxy
    "x-forwarded-for",  // Standard proxy header (comma-separated chain)
    "true-client-ip",   // Akamai & Cloudflare Enterprise
    "x-client-ip",
  ];

  for (const key of headerKeys) {
    const value = headers.get(key);
    if (value) {
      // If multiple IPs are present, the first one is the client's original IP
      const firstIp = value.split(",")[0].trim();
      if (firstIp && firstIp !== "::1" && firstIp !== "127.0.0.1") {
        return firstIp;
      }
    }
  }

  return "127.0.0.1";
}

/**
 * Lightweight, zero-dependency User-Agent and client info parser
 */
export function parseClientInfo(
  userAgentString: string | null | undefined,
  ip?: string
): ParsedClientInfo {
  const ua = userAgentString || "";

  // Default values
  let deviceType: DeviceType = "desktop";
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  // 1. Detect Device Type
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    deviceType = "tablet";
  } else if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
      ua
    )
  ) {
    deviceType = "mobile";
  } else {
    deviceType = "desktop";
  }

  // 2. Detect Operating System
  if (/Windows NT 10.0/i.test(ua)) os = "Windows 10/11";
  else if (/Windows NT 6.3/i.test(ua)) os = "Windows 8.1";
  else if (/Windows NT 6.2/i.test(ua)) os = "Windows 8";
  else if (/Windows NT 6.1/i.test(ua)) os = "Windows 7";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone/i.test(ua)) os = "iOS";
  else if (/iPad/i.test(ua)) os = "iPadOS";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/CrOS/i.test(ua)) os = "Chrome OS";

  // 3. Detect Browser
  if (/Edg\//i.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = "Samsung Internet";
  } else if (/Chrome\/|CriOS\//i.test(ua) && !/Edg\//i.test(ua)) {
    browser = "Chrome";
  } else if (/Firefox\/|FxiOS\//i.test(ua)) {
    browser = "Firefox";
  } else if (/Safari/i.test(ua) && !/Chrome\/|CriOS\//i.test(ua)) {
    browser = "Safari";
  }

  return {
    deviceType,
    browser,
    os,
    ipAddress: ip,
    rawUserAgent: ua,
  };
}

/**
 * Convenient helper to parse directly from a Next.js Request or Headers instance
 */
export function getClientMetadata(reqOrHeaders: Request | Headers): ParsedClientInfo {
  let headers: Headers;
  if (reqOrHeaders instanceof Request) {
    headers = reqOrHeaders.headers;
  } else {
    headers = reqOrHeaders;
  }

  const userAgent = headers.get("user-agent");
  const ip = extractClientIp(headers);

  return parseClientInfo(userAgent, ip);
}

