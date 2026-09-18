import { DeviceType, ParsedClientInfo } from "./types";

/**
 * Extracts the real client IP address from various standard HTTP proxy headers
 */
export function extractClientIp(headersSource: Request | Headers | Record<string, string | string[] | undefined>): string {
  const headers = normalizeHeaders(headersSource);

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
 * Extracts geo-location (country & city) from hosting-provider headers.
 * Zero-dependency: reads headers injected automatically by Vercel, Cloudflare, AWS CloudFront, and Fastly.
 */
export function extractGeoInfo(
  headersSource: Request | Headers | Record<string, string | string[] | undefined>
): { city?: string; country?: string } {
  const headers = normalizeHeaders(headersSource);

  let country: string | undefined;
  let city: string | undefined;

  // ── Vercel ──────────────────────────────────────────────
  const vercelCountry = headers.get("x-vercel-ip-country");
  const vercelCity = headers.get("x-vercel-ip-city");
  if (vercelCountry) country = vercelCountry;
  if (vercelCity) city = decodeURIComponent(vercelCity);

  // ── Cloudflare ─────────────────────────────────────────
  if (!country) {
    const cfCountry = headers.get("cf-ipcountry");
    if (cfCountry && cfCountry !== "XX") country = cfCountry;
  }
  if (!city) {
    const cfCity = headers.get("cf-ipcity");
    if (cfCity) city = decodeURIComponent(cfCity);
  }

  // ── AWS CloudFront ─────────────────────────────────────
  if (!country) {
    const awsCountry = headers.get("cloudfront-viewer-country");
    if (awsCountry) country = awsCountry;
  }
  if (!city) {
    const awsCity = headers.get("cloudfront-viewer-city");
    if (awsCity) city = decodeURIComponent(awsCity);
  }

  // ── Fastly ─────────────────────────────────────────────
  if (!country) {
    const fastlyCountry = headers.get("x-client-geo-country");
    if (fastlyCountry) country = fastlyCountry;
  }
  if (!city) {
    const fastlyCity = headers.get("x-client-geo-city");
    if (fastlyCity) city = decodeURIComponent(fastlyCity);
  }

  return { city, country };
}

/**
 * Converts a 2-letter ISO country code to its flag emoji.
 * e.g. "EG" → "🇪🇬", "US" → "🇺🇸"
 */
export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const code = countryCode.toUpperCase();
  const offset = 0x1F1E6 - 65; // 'A' = 65
  return String.fromCodePoint(
    code.charCodeAt(0) + offset,
    code.charCodeAt(1) + offset
  );
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
 * Convenient helper to parse directly from a Next.js Request or Headers instance.
 * Automatically extracts IP, User-Agent, and geo-location from hosting-provider headers.
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
  const geo = extractGeoInfo(headers);

  const info = parseClientInfo(userAgent, ip);
  info.city = geo.city;
  info.country = geo.country;

  return info;
}

// ── Internal helpers ──────────────────────────────────────

/**
 * Normalizes various header sources into a consistent { get(key) } interface
 */
function normalizeHeaders(
  headersSource: Request | Headers | Record<string, string | string[] | undefined>
): { get: (key: string) => string | null } {
  if (headersSource instanceof Request) {
    return headersSource.headers;
  } else if (typeof (headersSource as Headers).get === "function") {
    return headersSource as Headers;
  } else {
    // Record / plain object fallback
    const record = headersSource as Record<string, string | string[] | undefined>;
    return {
      get: (key: string) => {
        const val = record[key.toLowerCase()] || record[key];
        if (Array.isArray(val)) return val[0] || null;
        return val || null;
      },
    };
  }
}
