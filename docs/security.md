# Security Architecture & Hardening: html-pdf-engine

This document details the security posture and hardening measures built into `html-pdf-engine`.

---

## Security Model Overview

`html-pdf-engine` processes untrusted HTML and CSS input to produce static PDF files. It is explicitly hardened against common server-side document generator vulnerabilities.

---

## Hardening Measures

### 1. Complete Network & SSRF Isolation
- **Zero HTTP/HTTPS requests**: The engine contains no `http`, `https`, or `fetch` modules.
- **SSRF Prevention**: Remote URL references in `<img src="...">` or `<link href="...">` cannot trigger outgoing network requests or internal network scanning.

### 2. JavaScript Non-Execution
- **Script Disabling**: `<script>` tags and inline event handlers (`onclick`, `onload`) are safely ignored during layout rendering and never executed.
- **RCE Prevention**: Prevents Remote Code Execution through arbitrary script evaluation.

### 3. In-Memory Execution & Resource Bounds
- **Zero Binary Dependencies**: Avoids headless browser binary exploits.
- **Deterministic Heap Usage**: Pure memory processing prevents memory leaks associated with browser instance pools.

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
