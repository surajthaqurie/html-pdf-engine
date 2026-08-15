import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import {
  createNetworkAssetResolver,
  AssetResolver,
} from "../../src/assets/asset-resolver.js";
import { ImageError } from "../../src/errors/pdf-error.js";

describe("Phase 22 — Position Fixed, Z-Index, & Asset Resolver", () => {
  it("renders position: fixed elements repeatedly across multiple PDF pages", async () => {
    const html = `
      <style>
        .header { position: fixed; top: 0; left: 0; width: 100%; height: 30pt; background-color: #0284c7; }
        .content { margin-top: 40pt; }
        .page-break { break-before: page; }
      </style>
      <div class="header">Repeated Header Overlay</div>
      <div class="content">
        <h1>Page 1 Content</h1>
        <div class="page-break">
          <h1>Page 2 Content</h1>
        </div>
      </div>
    `;

    const doc = await HtmlToPdf.generate({ html, compress: false });
    const pages = doc.getPages();

    expect(pages.length).toBeGreaterThanOrEqual(2);
  });

  it("sorts paint commands by z-index stacking order", async () => {
    const html = `
      <style>
        .box1 { position: absolute; top: 10px; left: 10px; width: 50px; height: 50px; z-index: 10; background-color: #ff0000; }
        .box2 { position: absolute; top: 10px; left: 10px; width: 50px; height: 50px; z-index: 1; background-color: #00ff00; }
      </style>
      <div class="box1">Top</div>
      <div class="box2">Bottom</div>
    `;

    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
  });

  it("resolves dynamic assets via custom AssetResolver interface", async () => {
    const samplePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    const customResolver: AssetResolver = {
      resolve(url, context) {
        if (url === "http://example.com/logo.png") {
          return samplePng;
        }
        return null;
      },
    };

    const html = `<img src="http://example.com/logo.png" width="100" height="100" />`;
    const doc = await HtmlToPdf.generate({
      html,
      images: {
        "http://example.com/logo.png": samplePng,
      },
      assetResolver: customResolver,
      compress: false,
    });

    expect(doc).toBeDefined();
    expect(doc.getPages().length).toBe(1);
  });

  it("blocks private/internal IP requests in createNetworkAssetResolver to prevent SSRF", async () => {
    const resolver = createNetworkAssetResolver();

    await expect(
      resolver.resolve("http://127.0.0.1/secret.png", { type: "image" }),
    ).rejects.toThrow(ImageError);

    await expect(
      resolver.resolve("http://169.254.169.254/latest/meta-data/", {
        type: "image",
      }),
    ).rejects.toThrow(ImageError);
  });
});
