export interface PdfValidationResult {
  valid: boolean;
  errors: string[];
  objectCount: number;
  pageCount: number;
  pdfVersion: string;
}

export function validatePdfStructure(buffer: Buffer): PdfValidationResult {
  const errors: string[] = [];
  const str = buffer.toString("binary");

  // 1. Header Validation
  const headerMatch = str.match(/^%PDF-(1\.[0-7])/);
  if (!headerMatch) {
    errors.push("Invalid or missing PDF header. Expected %PDF-1.x at beginning of file.");
  }
  const pdfVersion = headerMatch ? headerMatch[1]! : "unknown";

  // 2. EOF marker validation
  if (!str.trimEnd().endsWith("%%EOF")) {
    errors.push("Missing %%EOF marker at end of PDF file.");
  }

  // 3. Extract startxref
  const startxrefMatch = str.match(/startxref\s+(\d+)\s+%%EOF/);
  if (!startxrefMatch) {
    errors.push("Missing startxref block before %%EOF.");
  } else {
    const startXrefOffset = parseInt(startxrefMatch[1]!, 10);
    if (isNaN(startXrefOffset) || startXrefOffset <= 0 || startXrefOffset >= buffer.length) {
      errors.push(`Invalid startxref offset: ${startXrefOffset}`);
    } else {
      // Verify xref keyword at startXrefOffset
      const xrefSlice = str.slice(startXrefOffset, startXrefOffset + 10);
      if (!xrefSlice.startsWith("xref")) {
        errors.push(`Expected 'xref' at offset ${startXrefOffset}, found: ${JSON.stringify(xrefSlice)}`);
      }
    }
  }

  // 4. Extract and parse all indirect objects: (\d+) (\d+) obj ... endobj
  const objectOffsets = new Map<number, number>();
  const objectRegex = /(\d+)\s+(\d+)\s+obj\b([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null;

  while ((match = objectRegex.exec(str)) !== null) {
    const objNum = parseInt(match[1]!, 10);
    const offset = match.index;

    if (objectOffsets.has(objNum)) {
      errors.push(`Duplicate object ID found: ${objNum}`);
    } else {
      objectOffsets.set(objNum, offset);
    }
  }

  // 5. Parse trailer dictionary
  const trailerMatch = str.match(/trailer\s*<<([\s\S]*?)>>\s*startxref/);
  let rootRef: number | null = null;
  let infoRef: number | null = null;

  if (!trailerMatch) {
    errors.push("Missing or invalid trailer dictionary.");
  } else {
    const trailerBody = trailerMatch[1]!;
    const rootMatch = trailerBody.match(/\/Root\s+(\d+)\s+0\s+R/);
    if (!rootMatch) {
      errors.push("Trailer missing /Root catalog reference.");
    } else {
      rootRef = parseInt(rootMatch[1]!, 10);
    }

    const infoMatch = trailerBody.match(/\/Info\s+(\d+)\s+0\s+R/);
    if (infoMatch) {
      infoRef = parseInt(infoMatch[1]!, 10);
    }

    const sizeMatch = trailerBody.match(/\/Size\s+(\d+)/);
    if (!sizeMatch) {
      errors.push("Trailer missing /Size specification.");
    }
  }

  // 6. Check Root catalog reference exists
  if (rootRef !== null) {
    if (!objectOffsets.has(rootRef)) {
      errors.push(`Dangling reference in trailer /Root: Object ${rootRef} does not exist.`);
    } else {
      const rootObjSlice = str.slice(objectOffsets.get(rootRef)!);
      if (!rootObjSlice.includes("/Type /Catalog")) {
        errors.push(`Object ${rootRef} referenced by /Root is not of /Type /Catalog.`);
      }
    }
  }

  // 7. Check Info reference if present
  if (infoRef !== null && !objectOffsets.has(infoRef)) {
    errors.push(`Dangling reference in trailer /Info: Object ${infoRef} does not exist.`);
  }

  // 8. Check all N 0 R references for dangling references
  const refRegex = /(\d+)\s+0\s+R/g;
  while ((match = refRegex.exec(str)) !== null) {
    const refObjNum = parseInt(match[1]!, 10);
    if (!objectOffsets.has(refObjNum)) {
      errors.push(`Dangling indirect reference: Object ${refObjNum} 0 R referenced but never defined.`);
    }
  }

  // 9. Count Pages
  const pagesMatches = str.match(/\/Type\s*\/Page\b/g);
  const pageCount = pagesMatches ? pagesMatches.length : 0;

  // 10. Check Stream lengths (/Length N or /Length N 0 R)
  const streamRegex = /(\d+)\s+0\s+obj[\s\S]*?\/Length\s+(\d+)[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g;
  while ((match = streamRegex.exec(str)) !== null) {
    const declaredLen = parseInt(match[2]!, 10);
    const streamContent = match[3]!;
    // Note: If uncompressed, streamContent length in bytes should match declared length
    if (!str.includes("/Filter") && streamContent.length !== declaredLen) {
      errors.push(
        `Stream length mismatch in obj ${match[1]!}: declared ${declaredLen}, actual ${streamContent.length}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    objectCount: objectOffsets.size,
    pageCount,
    pdfVersion,
  };
}
