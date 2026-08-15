import { PageMargins, PageSize, PageSizeName } from "../pdf/pdf-page.js";

export const DEFAULT_PAGE_SIZE_NAME: PageSizeName = "A4";
export const DEFAULT_PAGE_ORIENTATION = "portrait";

export const DEFAULT_PAGE_MARGINS: PageMargins = {
  top: 36,
  right: 36,
  bottom: 36,
  left: 36,
};

export const STANDARD_PAGE_DIMENSIONS: Record<PageSizeName, PageSize> = {
  A0: { width: 2383.94, height: 3370.39 },
  A1: { width: 1683.78, height: 2383.94 },
  A2: { width: 1190.55, height: 1683.78 },
  A3: { width: 841.89, height: 1190.55 },
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  A6: { width: 297.64, height: 419.53 },
  B4: { width: 708.66, height: 1000.63 },
  B5: { width: 498.9, height: 708.66 },
  Letter: { width: 612.0, height: 792.0 },
  Legal: { width: 612.0, height: 1008.0 },
  Tabloid: { width: 792.0, height: 1224.0 },
  Ledger: { width: 1224.0, height: 792.0 },
  Executive: { width: 522.0, height: 756.0 },
};
