/**
 * Asset Resolution Strategy
 *
 * By design, html-pdf-engine does NOT make any network requests during rendering.
 * All assets (images, fonts) are expected to be provided explicitly via `options.images`,
 * `options.fonts`, or local filesystem paths. This guarantees:
 *   - Byte-for-byte deterministic output across repeated renders
 *   - No side-channel network dependencies in server environments
 *   - No SSRF attack surface from untrusted HTML input
 *
 * The `AssetResolver` interface provides an opt-in escape hatch for consumers who need
 * to resolve dynamic or remote assets under controlled conditions. The resolver is
 * caller-owned: the engine passes the raw URL and context, and the resolver decides
 * whether and how to fetch. Errors thrown by the resolver propagate as ImageError.
 *
 * IMPORTANT: Using `createNetworkAssetResolver` introduces non-determinism if the
 * remote content changes between renders. For reproducible builds, prefer local files,
 * base64 data URLs, or a resolver backed by a content-addressed cache.
 */

import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { ImageError } from "../errors/pdf-error.js";

export interface AssetResolutionContext {
  /** Resource type being resolved: "image" or "font" */
  type: "image" | "font";
  /** Optional base path configured for rendering */
  basePath?: string;
}

/**
 * Opt-in interface for resolving remote or dynamically-sourced assets.
 *
 * The resolver is invoked when an image or font URL is not found in the
 * explicit `options.images` map, `options.fonts` map, or local filesystem.
 * Return `null` to signal "not found" (engine will throw ImageError).
 * Throw to signal a fatal error that should abort rendering.
 *
 * The resolver is synchronous or async. The engine `await`s the result.
 */
export interface AssetResolver {
  resolve(
    url: string,
    context: AssetResolutionContext,
  ): Promise<Buffer | Uint8Array | null> | Buffer | Uint8Array | null;
}

/**
 * Configuration for the built-in network asset resolver.
 *
 * All limits are per-request. For production use, always set explicit limits
 * appropriate for your trust boundary.
 */
export interface NetworkAssetResolverOptions {
  /**
   * Maximum response body size in bytes.
   * Checked against Content-Length header AND enforced during streaming.
   * Default: 10 MB (10 * 1024 * 1024)
   */
  maxSizeBytes?: number;
  /**
   * Socket and response timeout in milliseconds.
   * The HTTP connection is destroyed when this elapses.
   * Default: 5000 ms
   */
  timeoutMs?: number;
  /**
   * Maximum number of HTTP redirects (3xx) to follow per request.
   * Redirect cycles are terminated when this limit is exceeded.
   * Default: 3
   */
  maxRedirects?: number;
  /**
   * When false (default), requests to private/internal IP ranges are blocked
   * to prevent SSRF (Server-Side Request Forgery) attacks from HTML input.
   * Blocked ranges: 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x,
   * 169.254.169.254 (cloud metadata), ::1, localhost.
   *
   * Set to true ONLY in fully trusted environments where private resources
   * are explicitly intended to be fetched.
   */
  allowPrivateIPs?: boolean;
}

/**
 * Checks if a hostname or IP resolves to a private/internal network range.
 * Used by createNetworkAssetResolver to block SSRF attack vectors.
 *
 * Note: This performs a string-level check only. It does not perform DNS
 * resolution, so DNS rebinding attacks are not fully prevented here.
 * For production SSRF prevention, use a firewall or egress proxy in addition.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "169.254.169.254" // AWS / GCP / Azure cloud metadata endpoint
  ) {
    return true;
  }
  // RFC 1918 private IPv4 ranges
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("172.")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[1]) {
      const second = parseInt(parts[1], 10);
      if (!isNaN(second) && second >= 16 && second <= 31) return true;
    }
  }
  return false;
}

/**
 * Creates an opt-in network asset resolver with SSRF protection and resource limits.
 *
 * This resolver should only be used when the HTML input is trusted or when remote
 * asset URLs are explicitly validated before reaching the engine. Untrusted HTML
 * with `<img src="http://...">` combined with a permissive resolver is a potential
 * SSRF vector even with the built-in IP blocklist.
 *
 * Usage:
 * ```typescript
 * const resolver = createNetworkAssetResolver({ maxSizeBytes: 5_000_000, timeoutMs: 3000 });
 * const pdf = await HtmlToPdf.generateBuffer({ html, assetResolver: resolver });
 * ```
 */
export function createNetworkAssetResolver(
  options: NetworkAssetResolverOptions = {},
): AssetResolver {
  const maxSizeBytes = options.maxSizeBytes ?? 10 * 1024 * 1024; // 10 MB
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxRedirects = options.maxRedirects ?? 3;
  const allowPrivateIPs = options.allowPrivateIPs ?? false;

  return {
    async resolve(
      urlStr: string,
      context: AssetResolutionContext,
    ): Promise<Buffer | null> {
      let currentUrl = urlStr.trim();
      let redirectCount = 0;

      while (redirectCount <= maxRedirects) {
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(currentUrl);
        } catch {
          // Malformed URL — treat as unresolvable
          return null;
        }

        // Protocol restriction: only HTTP and HTTPS are permitted.
        // file://, data://, ftp://, etc. are blocked unconditionally.
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          throw new ImageError(
            `Security error: forbidden asset protocol "${parsedUrl.protocol}" for URL "${currentUrl}"`,
          );
        }

        // SSRF protection: block private IP ranges unless explicitly opted in.
        if (!allowPrivateIPs && isPrivateHost(parsedUrl.hostname)) {
          throw new ImageError(
            `Security error: access to private/internal host "${parsedUrl.hostname}" is forbidden for asset URL "${currentUrl}"`,
          );
        }

        const client = parsedUrl.protocol === "https:" ? https : http;

        const buffer = await new Promise<Buffer | null>((resolve, reject) => {
          const req = client.get(
            parsedUrl.href,
            {
              headers: {
                "User-Agent": "html-pdf-engine AssetResolver/1.10",
                Accept: context.type === "image" ? "image/*" : "font/*,*/*",
              },
            },
            (res) => {
              // Handle HTTP redirects — resolve null to signal the outer loop to retry
              if (
                res.statusCode &&
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
              ) {
                res.resume(); // consume and discard the response body
                try {
                  const target = new URL(res.headers.location, parsedUrl.href);
                  resolve(null); // signal redirect
                  currentUrl = target.href;
                } catch {
                  reject(new ImageError(`Malformed redirect location in asset URL "${currentUrl}"`));
                }
                return;
              }

              if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                res.resume();
                resolve(null); // non-2xx response: asset not available
                return;
              }

              // Reject early if Content-Length exceeds limit (avoids downloading large bodies)
              const contentLength = res.headers["content-length"];
              if (contentLength) {
                const len = parseInt(contentLength, 10);
                if (!isNaN(len) && len > maxSizeBytes) {
                  res.resume();
                  reject(
                    new ImageError(
                      `Asset size limit exceeded: resource "${currentUrl}" (${len} bytes) exceeds limit of ${maxSizeBytes} bytes`,
                    ),
                  );
                  return;
                }
              }

              const chunks: Buffer[] = [];
              let totalBytes = 0;

              res.on("data", (chunk: Buffer) => {
                totalBytes += chunk.length;
                // Streaming size check: abort if limit is exceeded mid-download
                if (totalBytes > maxSizeBytes) {
                  req.destroy();
                  reject(
                    new ImageError(
                      `Asset size limit exceeded: downloading "${currentUrl}" exceeded limit of ${maxSizeBytes} bytes`,
                    ),
                  );
                  return;
                }
                chunks.push(chunk);
              });

              res.on("end", () => {
                resolve(Buffer.concat(chunks));
              });

              res.on("error", (err) => {
                reject(
                  new ImageError(
                    `Network error resolving asset "${currentUrl}": ${err.message}`,
                  ),
                );
              });
            },
          );

          req.on("error", (err) => {
            reject(
              new ImageError(
                `Network error resolving asset "${currentUrl}": ${err.message}`,
              ),
            );
          });

          // Socket timeout: destroy the connection if the server is too slow
          req.setTimeout(timeoutMs, () => {
            req.destroy();
            reject(
              new ImageError(
                `Network timeout resolving asset "${currentUrl}": exceeded ${timeoutMs}ms`,
              ),
            );
          });
        });

        if (buffer !== null) {
          return buffer;
        }

        redirectCount++;
      }

      throw new ImageError(
        `Too many redirects resolving asset URL "${urlStr}": limit is ${maxRedirects}`,
      );
    },
  };
}
