import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 10 — Certificate of Completion", () => {
  it("renders a landscape certificate of completion with decorative borders and signatures", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @page { size: A4 landscape; margin: 20pt; }
            body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; text-align: center; }
            .border-outer { border: 6px double #b45309; padding: 25px; background: #fffbeb; }
            .border-inner { border: 1px solid #d97706; padding: 30px; }
            .cert-title { font-size: 26pt; color: #92400e; font-weight: bold; margin-bottom: 10px; letter-spacing: 2px; }
            .cert-sub { font-size: 12pt; color: #78350f; margin-bottom: 25px; }
            .recipient { font-size: 24pt; color: #1e293b; font-weight: bold; text-decoration: underline; margin: 15px 0; }
            .reason { font-size: 12pt; color: #475569; width: 80%; margin: 0 auto 35px auto; line-height: 1.5; }
            .signatures { display: flex; justify-content: space-around; margin-top: 40px; }
            .sig-box { width: 35%; border-top: 1px solid #78350f; padding-top: 5px; font-size: 10pt; color: #78350f; }
          </style>
        </head>
        <body>
          <div class="border-outer">
            <div class="border-inner">
              <div class="cert-title">CERTIFICATE OF ACHIEVEMENT</div>
              <div class="cert-sub">This is proudly presented to</div>
              <div class="recipient">Dr. Alex V. Mercer</div>
              <div class="reason">
                For successfully completing the Advanced Systems Engineering & High-Performance PDF Rendering Masterclass, demonstrating mastery in layout algorithms, typography subsetting, and zero-dependency PDF stream serialization.
              </div>
              <div class="signatures">
                <div class="sig-box">
                  <strong>Sarah Jenkins</strong><br/>
                  Director of Education
                </div>
                <div class="sig-box">
                  <strong>Marcus Vance</strong><br/>
                  Lead PDF Engine Architect
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html, orientation: "landscape" });
    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBe(1);
  });
});
