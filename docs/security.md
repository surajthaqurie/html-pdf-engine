# Security Architecture & Hardening: html-pdf-engine

This document details the security posture and hardening measures built into `html-pdf-engine`.

---

## Security Model Overview

`html-pdf-engine` processes untrusted HTML and CSS input to produce static PDF files. It is explicitly hardened against common server-side document generator vulnerabilities.

---

## Hardening Measures

### 1. Default Offline Security & Opt-In SSRF Protections
- **Default Offline Execution**: The default rendering pipeline initiates no implicit network requests for remote stylesheets, images, or web fonts.
- **Opt-In Network Resolution (`createNetworkAssetResolver`)**: When remote asset loading is required, applications can pass an opt-in network resolver configured with:
  - **SSRF Protection**: Blocks local and private IP address ranges (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`) by default.
  - **Resource Boundaries**: Strict configurable response size limits (`maxSizeBytes`), connection timeouts (`timeoutMs`), and HTTP redirect limits (`maxRedirects`).
  - **Protocol Filtering**: Restricts fetches strictly to HTTP/HTTPS schemes, rejecting arbitrary protocols (`file://`, `gopher://`).

### 2. JavaScript Non-Execution & Isolation
- **Script Neutralization**: `<script>` tags and inline event handlers (`onclick`, `onload`, `onerror`) are parsed and assigned `display: none`, completely stripping them from execution.
- **RCE Prevention**: Prevents Remote Code Execution vulnerabilities associated with evaluation of untrusted dynamic script strings.

### 3. PDF Encoding & Serialization Safety
- **String Escaping**: Uses `escapePdfString` for literal PDF strings, properly escaping parentheses `()`, backslashes `\`, and unprintable characters to prevent stream injection attacks.
- **Unicode Support**: Safely serializes UTF-16BE hex strings with Byte Order Marks (`FEFF`) for non-ASCII characters (such as Devanagari, CJK, and special symbols).

### 4. Malformed Input Resilience
- **HTML Recovery**: Auto-recovers from unclosed tags, dangling attributes, and unescaped HTML entities without crashing.
- **CSS Fault Tolerance**: Property value resolution is wrapped in isolated exception handlers, preventing malformed CSS declarations (e.g. `calc(;;;)`, invalid units) from crashing server worker threads.

### 5. In-Memory Execution & Resource Bounds
- **Zero Subprocess Exploits**: Pure Node.js execution avoids binary exploit vectors inherent in headless browser automation packages.
- **Deterministic Memory Allocation**: Thread-safe isolated `LayoutContext` instances prevent global state contamination across concurrent rendering tasks.

---

## File System Recommendations

When using `HtmlToPdf.generateFile({ output })`, ensure application-level path validation prevents path traversal:

```typescript
import * as path from "path";

function safeOutputPath(userFilename: string): string {
  const safeName = path.basename(userFilename);
  return path.join("/tmp/pdf-exports", safeName);
}
```
