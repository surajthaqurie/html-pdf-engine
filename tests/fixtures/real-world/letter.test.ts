import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 11 — Formal Business Letter", () => {
  it("renders a formal business letter with letterhead and signature block", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; font-size: 11pt; line-height: 1.6; }
            .letterhead { display: flex; justify-content: space-between; border-bottom: 2px solid #334155; padding-bottom: 15px; margin-bottom: 30px; }
            .company { font-weight: bold; font-size: 14pt; color: #0f172a; }
            .address { font-size: 9pt; color: #64748b; text-align: right; }
            .date { margin-bottom: 20px; color: #475569; }
            .recipient { margin-bottom: 25px; }
            .content p { margin-bottom: 15px; text-align: justify; }
            .signature-block { margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="letterhead">
            <div>
              <div class="company">Vanguard Legal & Compliance Advisory</div>
              <div style="font-size: 9pt; color: #475569;">Corporate Governance Division</div>
            </div>
            <div class="address">
              100 Financial Way, Suite 1200<br/>
              New York, NY 10005<br/>
              contact@vanguardlegal.com
            </div>
          </div>

          <div class="date">August 15, 2026</div>

          <div class="recipient">
            <strong>Board of Directors</strong><br/>
            Apex Global Technologies Inc.<br/>
            500 Innovation Boulevard<br/>
            Austin, TX 78701
          </div>

          <div class="content">
            <p><strong>Subject: Regulatory Conformance Audit & Compliance Certification</strong></p>
            <p>Dear Members of the Board,</p>
            <p>
              We have completed our formal evaluation of your server-side document generation pipelines. We are pleased to report that the migration to the zero-dependency PDF rendering engine has met all compliance standards for data privacy, byte-level determinism, and isolated concurrent execution.
            </p>
            <p>
              By eliminating third-party browser runtimes and external process dependencies, the platform has successfully eliminated SSRF risk vectors while reducing server resource utilization by over 75%.
            </p>
            <p>
              Should you require additional documentation or audit artifacts, please do not hesitate to contact our team.
            </p>
          </div>

          <div class="signature-block">
            Sincerely,<br/><br/>
            <strong>Eleanor Vance, Esq.</strong><br/>
            Managing Partner | Vanguard Advisory Group
          </div>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html });
    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBe(1);
  });
});
