import {
  PDFPage,
  PageSizeName,
  PageOrientation,
  PageMargins,
  PageSize,
} from "./pdf-page.js";
import {
  PDFDictionary,
  PDFArray,
  PDFName,
  PDFRef,
  PDFNumber,
  PDFString,
  PDFIndirectObject,
} from "./pdf-object.js";
import { PDFStream } from "./pdf-stream.js";
import { PDFFont } from "./pdf-font.js";
import { XRefTable } from "./xref.js";
import { PDFTrailer } from "./trailer.js";

import { HeaderFooterOptions, HeaderFooterRenderer } from "./pdf-header-footer.js";
import { ParsedImageData } from "./pdf-image.js";
import { FontManager, Font } from "../fonts/font.js";
import { createPDFType0Font } from "./pdf-ttf-font.js";
import { subsetTTF } from "../fonts/ttf-subsetter.js";
import { PDFDestination } from "../layout/layout-context.js";
import { PDFBoolean } from "./pdf-object.js";

export type PdfVersion = "1.3" | "1.4" | "1.5" | "1.6" | "1.7";

export interface PdfViewerPreferences {
  hideToolbar?: boolean;
  hideMenubar?: boolean;
  hideWindowUI?: boolean;
  fitWindow?: boolean;
  centerWindow?: boolean;
  displayDocTitle?: boolean;
}

export type PageLabelStyle =
  | "decimal"
  | "lowercase-roman"
  | "uppercase-roman"
  | "lowercase-letters"
  | "uppercase-letters";

export interface PageLabelRange {
  startPage?: number;
  style?: PageLabelStyle;
  prefix?: string;
  firstNumber?: number;
}

export interface PDFMetadataOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string | string[];
  creator?: string;
  producer?: string;
}

export class PDFDocument {
  private pages: PDFPage[] = [];
  private fontMap: Map<
    string,
    { fontName: string; alias: string; objNum?: number }
  > = new Map();
  private imageMap: Map<
    string,
    { alias: string; imageData: ParsedImageData; objNum?: number }
  > = new Map();
  private usedCodePointsMap: Map<string, Set<number>> = new Map();
  private nextObjectNumber = 1;
  private compressOutput: boolean = true;
  private headerOptions?: HeaderFooterOptions;
  private footerOptions?: HeaderFooterOptions;
  private metadataOptions?: PDFMetadataOptions;
  private headerFooterRenderer = new HeaderFooterRenderer();
  private pdfVersion: PdfVersion = "1.7";
  private language?: string;
  private viewerPreferences?: PdfViewerPreferences;
  private pageLabelRanges: PageLabelRange[] = [];
  private destinations: Map<string, PDFDestination> = new Map();

  constructor() {
    // Default register standard Helvetica font as F1
    this.addFont("Helvetica", "F1");
  }

  registerFontUsage(fontName: string, text: string): void {
    let set = this.usedCodePointsMap.get(fontName);
    if (!set) {
      set = new Set<number>();
      this.usedCodePointsMap.set(fontName, set);
    }
    for (const char of text) {
      const cp = char.codePointAt(0);
      if (cp !== undefined) {
        set.add(cp);
      }
    }
  }

  setCompress(compress: boolean): this {
    this.compressOutput = compress;
    return this;
  }

  setHeader(options: HeaderFooterOptions): this {
    this.headerOptions = options;
    return this;
  }

  setFooter(options: HeaderFooterOptions): this {
    this.footerOptions = options;
    return this;
  }

  setMetadata(options: PDFMetadataOptions): this {
    this.metadataOptions = options;
    return this;
  }

  setPdfVersion(version: PdfVersion): this {
    this.pdfVersion = version;
    return this;
  }

  setLanguage(language: string): this {
    this.language = language;
    return this;
  }

  setViewerPreferences(preferences: PdfViewerPreferences): this {
    this.viewerPreferences = preferences;
    return this;
  }

  setPageLabels(labels: PageLabelRange | PageLabelRange[]): this {
    this.pageLabelRanges = Array.isArray(labels) ? labels : [labels];
    return this;
  }

  setDestinations(destinations: Map<string, PDFDestination> | PDFDestination[]): this {
    if (Array.isArray(destinations)) {
      for (const d of destinations) {
        if (d && d.name && !this.destinations.has(d.name)) {
          this.destinations.set(d.name, d);
        }
      }
    } else if (destinations instanceof Map) {
      for (const [k, v] of destinations.entries()) {
        if (!this.destinations.has(k)) {
          this.destinations.set(k, v);
        }
      }
    }
    return this;
  }

  getDestination(name: string): PDFDestination | undefined {
    return this.destinations.get(name.trim());
  }

  getDestinations(): Map<string, PDFDestination> {
    return new Map(this.destinations);
  }

  addPage(
    pageSize: PageSizeName | PageSize = "A4",
    orientation: PageOrientation = "portrait",
    margins?: PageMargins,
  ): PDFPage {
    const page = new PDFPage(pageSize, orientation, margins);
    this.pages.push(page);
    return page;
  }

  addFont(fontName: string, alias?: string): string {
    const fontAlias = alias ?? `F${this.fontMap.size + 1}`;
    if (!this.fontMap.has(fontName)) {
      this.fontMap.set(fontName, { fontName, alias: fontAlias });
    }
    return fontAlias;
  }

  addImage(imageData: ParsedImageData): string {
    for (const [alias, val] of this.imageMap.entries()) {
      if (val.imageData === imageData) {
        return alias;
      }
    }
    const alias = `Im${this.imageMap.size + 1}`;
    this.imageMap.set(alias, { alias, imageData });
    return alias;
  }

  getPages(): PDFPage[] {
    return [...this.pages];
  }

  save(): Buffer {
    if (this.pages.length === 0) {
      this.addPage();
    }

    // Apply header and footer to all pages if configured
    if (this.headerOptions || this.footerOptions) {
      const totalPages = this.pages.length;
      for (let i = 0; i < totalPages; i++) {
        const page = this.pages[i];
        if (page) {
          this.headerFooterRenderer.renderHeaderAndFooter(
            page,
            i + 1,
            totalPages,
            {
              header: this.headerOptions,
              footer: this.footerOptions,
            },
          );
        }
      }
    }

    const chunks: Uint8Array[] = [];
    const xref = new XRefTable();
    let currentOffset = 0;

    // Helper to append bytes and track offset
    const writeChunk = (chunk: Uint8Array) => {
      chunks.push(chunk);
      currentOffset += chunk.length;
    };

    // 1. PDF Header with configurable version comment
    const versionHeader = `%PDF-${this.pdfVersion}\n%\xE2\xE3\xCF\xD3\n`;
    const headerBytes = new TextEncoder().encode(versionHeader);
    writeChunk(headerBytes);

    // Allocate object numbers
    const catalogObjNum = this.nextObjectNumber++;
    const pagesObjNum = this.nextObjectNumber++;

    // Font indirect objects
    const fontDictRefs: Record<string, PDFRef> = {};
    const fontIndirectObjs: PDFIndirectObject[] = [];
    const fontManager = new FontManager();
    const codePointToGidMaps = new Map<string, Map<number, number>>();

    for (const [fontName, info] of this.fontMap.entries()) {
      const font = fontManager.getFont(fontName);
      if (font.isCustom && font.parsedTTF) {
        const usedCps =
          this.usedCodePointsMap.get(fontName) ?? new Set<number>();
        const subsetItem = subsetTTF(font.parsedTTF, usedCps);
        codePointToGidMaps.set(fontName, subsetItem.codePointToSubsetGidMap);

        const subsetFont = new Font(font.name, subsetItem.subsetParsedTTF);

        const { fontObj, auxiliaryObjs } = createPDFType0Font(
          subsetFont,
          () => this.nextObjectNumber++,
          this.compressOutput,
        );
        info.objNum = fontObj.objectNumber;
        for (const aux of auxiliaryObjs) {
          fontIndirectObjs.push(aux);
        }
        fontIndirectObjs.push(fontObj);
        fontDictRefs[info.alias] = fontObj.ref;
      } else {
        const fontObjNum = this.nextObjectNumber++;
        info.objNum = fontObjNum;
        const pdfFont = new PDFFont(info.alias, fontName);
        const indObj = new PDFIndirectObject(fontObjNum, pdfFont.dictionary);
        fontIndirectObjs.push(indObj);
        fontDictRefs[info.alias] = indObj.ref;
      }
    }

    // Image indirect objects
    const imageDictRefs: Record<string, PDFRef> = {};
    const imageIndirectObjs: PDFIndirectObject[] = [];

    for (const [alias, info] of this.imageMap.entries()) {
      let smaskRef: PDFRef | undefined = undefined;
      if (info.imageData.smaskData) {
        const smaskObjNum = this.nextObjectNumber++;
        const smaskStream = new PDFStream(
          info.imageData.smaskData,
          {
            Type: new PDFName("XObject"),
            Subtype: new PDFName("Image"),
            Width: new PDFNumber(info.imageData.width),
            Height: new PDFNumber(info.imageData.height),
            ColorSpace: new PDFName("DeviceGray"),
            BitsPerComponent: new PDFNumber(8),
            Filter: new PDFName("FlateDecode"),
          },
          false,
        );
        const smaskObj = new PDFIndirectObject(smaskObjNum, smaskStream);
        imageIndirectObjs.push(smaskObj);
        smaskRef = smaskObj.ref;
      }

      const imgObjNum = this.nextObjectNumber++;
      info.objNum = imgObjNum;

      const imgDictEntries: Record<string, any> = {
        Type: new PDFName("XObject"),
        Subtype: new PDFName("Image"),
        Width: new PDFNumber(info.imageData.width),
        Height: new PDFNumber(info.imageData.height),
        ColorSpace: new PDFName(info.imageData.colorSpace),
        BitsPerComponent: new PDFNumber(info.imageData.bitsPerComponent),
        Filter: new PDFName(info.imageData.filter),
      };

      if (smaskRef) {
        imgDictEntries.SMask = smaskRef;
      }

      const imgStream = new PDFStream(
        info.imageData.pdfStreamData,
        imgDictEntries,
        false,
      );

      const imgIndObj = new PDFIndirectObject(imgObjNum, imgStream);
      imageIndirectObjs.push(imgIndObj);
      imageDictRefs[alias] = imgIndObj.ref;
    }

    // Resources object (Font & XObject dictionaries)
    const resourceObjNum = this.nextObjectNumber++;
    const fontResourceDict = new PDFDictionary();
    for (const [alias, ref] of Object.entries(fontDictRefs)) {
      fontResourceDict.set(alias, ref);
    }
    const xobjectResourceDict = new PDFDictionary();
    for (const [alias, ref] of Object.entries(imageDictRefs)) {
      xobjectResourceDict.set(alias, ref);
    }

    const resourceDict = new PDFDictionary({
      Font: fontResourceDict,
      XObject: xobjectResourceDict,
      ProcSet: new PDFArray([
        new PDFName("PDF"),
        new PDFName("Text"),
        new PDFName("ImageB"),
        new PDFName("ImageC"),
        new PDFName("I"),
      ]),
    });
    const resourceIndirectObj = new PDFIndirectObject(
      resourceObjNum,
      resourceDict,
    );

    // Pre-allocate Page Object numbers and references
    const pagesRef = new PDFRef(pagesObjNum);
    const pageRefs: PDFRef[] = [];
    const pageObjNums: number[] = [];

    for (let i = 0; i < this.pages.length; i++) {
      const pObjNum = this.nextObjectNumber++;
      pageObjNums.push(pObjNum);
      pageRefs.push(new PDFRef(pObjNum));
    }

    const pageIndirectObjs: {
      pageObj: PDFIndirectObject;
      contentObj: PDFIndirectObject;
      annotObjs: PDFIndirectObject[];
    }[] = [];

    const gidResolver = (fName: string, text: string): string => {
      const map = codePointToGidMaps.get(fName);
      const font = fontManager.getFont(fName);
      let hex = "";
      for (const char of text) {
        const cp = char.codePointAt(0)!;
        let gid = 0;
        if (map && map.has(cp)) {
          gid = map.get(cp)!;
        } else if (font) {
          gid = font.charToGid(cp);
        }
        hex += gid.toString(16).padStart(4, "0");
      }
      return hex;
    };

    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i]!;
      const pageObjNum = pageObjNums[i]!;
      const contentObjNum = this.nextObjectNumber++;

      const contentBytes = page.contentStream.toBytes(gidResolver);
      const pdfStream = new PDFStream(
        contentBytes,
        undefined,
        this.compressOutput,
      );
      const contentIndirectObj = new PDFIndirectObject(
        contentObjNum,
        pdfStream,
      );

      const annotObjs: PDFIndirectObject[] = [];
      const annotRefs: PDFRef[] = [];

      for (const annot of page.annotations) {
        if (annot.target.type === "goto") {
          const targetPageIndex = (annot.target as any).targetPageIndex ?? i;
          const targetRef = pageRefs[targetPageIndex] ?? pageRefs[i];
          (annot.target as any).pageRef = targetRef;
        }

        const annotObjNum = this.nextObjectNumber++;
        const annotObj = new PDFIndirectObject(
          annotObjNum,
          annot.toDictionary(),
        );
        annotObjs.push(annotObj);
        annotRefs.push(annotObj.ref);
      }

      const pageDict = page.toDictionary(
        pagesRef,
        resourceIndirectObj.ref,
        contentIndirectObj.ref,
        annotRefs.length > 0 ? annotRefs : undefined,
      );
      const pageIndirectObj = new PDFIndirectObject(pageObjNum, pageDict);

      pageIndirectObjs.push({
        pageObj: pageIndirectObj,
        contentObj: contentIndirectObj,
        annotObjs,
      });
    }

    // Catalog & Pages objects
    const catalogDict = new PDFDictionary({
      Type: new PDFName("Catalog"),
      Pages: pagesRef,
    });

    if (this.language) {
      catalogDict.set("Lang", new PDFString(this.language));
    }

    if (this.viewerPreferences) {
      const vpDict = new PDFDictionary();
      if (this.viewerPreferences.hideToolbar !== undefined)
        vpDict.set("HideToolbar", new PDFBoolean(this.viewerPreferences.hideToolbar));
      if (this.viewerPreferences.hideMenubar !== undefined)
        vpDict.set("HideMenubar", new PDFBoolean(this.viewerPreferences.hideMenubar));
      if (this.viewerPreferences.hideWindowUI !== undefined)
        vpDict.set("HideWindowUI", new PDFBoolean(this.viewerPreferences.hideWindowUI));
      if (this.viewerPreferences.fitWindow !== undefined)
        vpDict.set("FitWindow", new PDFBoolean(this.viewerPreferences.fitWindow));
      if (this.viewerPreferences.centerWindow !== undefined)
        vpDict.set("CenterWindow", new PDFBoolean(this.viewerPreferences.centerWindow));
      if (this.viewerPreferences.displayDocTitle !== undefined)
        vpDict.set("DisplayDocTitle", new PDFBoolean(this.viewerPreferences.displayDocTitle));
      if (vpDict.entries().length > 0) {
        catalogDict.set("ViewerPreferences", vpDict);
      }
    }

    if (this.pageLabelRanges.length > 0) {
      const numsArray = new PDFArray();
      for (const labelRange of this.pageLabelRanges) {
        const pageIdx = Math.max(0, (labelRange.startPage ?? 1) - 1);
        const dict = new PDFDictionary();
        if (labelRange.style) {
          const styleNameMap: Record<PageLabelStyle, string> = {
            decimal: "D",
            "lowercase-roman": "r",
            "uppercase-roman": "R",
            "lowercase-letters": "a",
            "uppercase-letters": "A",
          };
          dict.set("S", new PDFName(styleNameMap[labelRange.style] || "D"));
        }
        if (labelRange.prefix) {
          dict.set("P", new PDFString(labelRange.prefix));
        }
        if (labelRange.firstNumber !== undefined && labelRange.firstNumber > 0) {
          dict.set("St", new PDFNumber(labelRange.firstNumber));
        }
        numsArray.push(new PDFNumber(pageIdx));
        numsArray.push(dict);
      }
      catalogDict.set("PageLabels", new PDFDictionary({ Nums: numsArray }));
    }

    const catalogIndirectObj = new PDFIndirectObject(
      catalogObjNum,
      catalogDict,
    );

    const pagesDict = new PDFDictionary({
      Type: new PDFName("Pages"),
      Kids: new PDFArray(pageRefs),
      Count: new PDFNumber(pageRefs.length),
    });
    const pagesIndirectObj = new PDFIndirectObject(pagesObjNum, pagesDict);

    // Write Objects to Stream & Record XRef
    const writeObject = (obj: PDFIndirectObject) => {
      xref.addEntry(obj.objectNumber, currentOffset);
      writeChunk(obj.toBytes());
    };

    // 2. Catalog
    writeObject(catalogIndirectObj);

    // 3. Pages
    writeObject(pagesIndirectObj);

    // 4. Fonts
    for (const fontObj of fontIndirectObjs) {
      writeObject(fontObj);
    }

    // 4b. Images
    for (const imgObj of imageIndirectObjs) {
      writeObject(imgObj);
    }

    // 5. Resource Dictionary
    writeObject(resourceIndirectObj);

    // 6. Page Annotations, Contents & Pages
    for (const item of pageIndirectObjs) {
      for (const annotObj of item.annotObjs) {
        writeObject(annotObj);
      }
      writeObject(item.contentObj);
      writeObject(item.pageObj);
    }

    // Optional Info Metadata Object
    let infoRef: PDFRef | undefined = undefined;
    if (this.metadataOptions) {
      const infoObjNum = this.nextObjectNumber++;
      const infoDict = new PDFDictionary();
      if (this.metadataOptions.title)
        infoDict.set("Title", new PDFString(this.metadataOptions.title));
      if (this.metadataOptions.author)
        infoDict.set("Author", new PDFString(this.metadataOptions.author));
      if (this.metadataOptions.subject)
        infoDict.set("Subject", new PDFString(this.metadataOptions.subject));
      if (this.metadataOptions.keywords) {
        const kwStr = Array.isArray(this.metadataOptions.keywords)
          ? this.metadataOptions.keywords.join(", ")
          : this.metadataOptions.keywords;
        infoDict.set("Keywords", new PDFString(kwStr));
      }
      if (this.metadataOptions.creator)
        infoDict.set("Creator", new PDFString(this.metadataOptions.creator));
      infoDict.set(
        "Producer",
        new PDFString(this.metadataOptions.producer ?? "html-pdf-engine"),
      );

      const infoIndirectObj = new PDFIndirectObject(infoObjNum, infoDict);
      infoRef = infoIndirectObj.ref;

      writeObject(infoIndirectObj);
    }

    // 7. XRef Table
    const startXRefOffset = currentOffset;
    const xrefBytes = xref.toBytes();
    writeChunk(xrefBytes);

    // 8. Trailer
    const trailer = new PDFTrailer(xref.size, catalogIndirectObj.ref, infoRef);
    const trailerBytes = trailer.toBytes(startXRefOffset);
    writeChunk(trailerBytes);

    // Combine all chunks into a Buffer
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = Buffer.alloc(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }
}
