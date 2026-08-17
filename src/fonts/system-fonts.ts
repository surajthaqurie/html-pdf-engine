/**
 * System Font Auto-Embedder
 *
 * Resolves high-quality TrueType system fonts for the three standard PDF font
 * families. When system fonts are available, they are embedded as full TTF
 * fonts in the PDF, which eliminates the "low-quality substitution" problem
 * that occurs when PDF viewers substitute missing Type1 standard fonts.
 *
 * Resolution order per family (first found wins):
 *
 *   sans-serif / Helvetica / Arial
 *     Liberation Sans → DejaVu Sans → FreeSans → Nimbus Sans
 *
 *   serif / Times / Times-Roman
 *     Liberation Serif → DejaVu Serif → FreeSerif → Nimbus Roman
 *
 *   monospace / Courier
 *     Liberation Mono → DejaVu Sans Mono → FreeMono → Nimbus Mono
 */

import * as fs from "fs";
import * as path from "path";

export interface SystemFontVariant {
  regular?: string;
  bold?: string;
  italic?: string;
  boldItalic?: string;
}

export interface SystemFontFamily {
  name: string;
  aliases: string[];
  variants: SystemFontVariant;
}



/**
 * Candidate TTF paths for each font family, in preference order.
 * Each entry is [regular, bold, italic, boldItalic].
 */
const SANS_SERIF_CANDIDATES: [string, string, string, string][] = [
  [
    "truetype/liberation/LiberationSans-Regular.ttf",
    "truetype/liberation/LiberationSans-Bold.ttf",
    "truetype/liberation/LiberationSans-Italic.ttf",
    "truetype/liberation/LiberationSans-BoldItalic.ttf",
  ],
  [
    "truetype/dejavu/DejaVuSans.ttf",
    "truetype/dejavu/DejaVuSans-Bold.ttf",
    "truetype/dejavu/DejaVuSans-Oblique.ttf",
    "truetype/dejavu/DejaVuSans-BoldOblique.ttf",
  ],
  [
    "truetype/freefont/FreeSans.ttf",
    "truetype/freefont/FreeSansBold.ttf",
    "truetype/freefont/FreeSansOblique.ttf",
    "truetype/freefont/FreeSansBoldOblique.ttf",
  ],
];

const SERIF_CANDIDATES: [string, string, string, string][] = [
  [
    "truetype/liberation/LiberationSerif-Regular.ttf",
    "truetype/liberation/LiberationSerif-Bold.ttf",
    "truetype/liberation/LiberationSerif-Italic.ttf",
    "truetype/liberation/LiberationSerif-BoldItalic.ttf",
  ],
  [
    "truetype/dejavu/DejaVuSerif.ttf",
    "truetype/dejavu/DejaVuSerif-Bold.ttf",
    "truetype/dejavu/DejaVuSerif-Italic.ttf",
    "truetype/dejavu/DejaVuSerif-BoldItalic.ttf",
  ],
  [
    "truetype/freefont/FreeSerif.ttf",
    "truetype/freefont/FreeSerifBold.ttf",
    "truetype/freefont/FreeSerifItalic.ttf",
    "truetype/freefont/FreeSerifBoldItalic.ttf",
  ],
];

const MONO_CANDIDATES: [string, string, string, string][] = [
  [
    "truetype/liberation/LiberationMono-Regular.ttf",
    "truetype/liberation/LiberationMono-Bold.ttf",
    "truetype/liberation/LiberationMono-Italic.ttf",
    "truetype/liberation/LiberationMono-BoldItalic.ttf",
  ],
  [
    "truetype/dejavu/DejaVuSansMono.ttf",
    "truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "truetype/dejavu/DejaVuSansMono-Oblique.ttf",
    "truetype/dejavu/DejaVuSansMono-BoldOblique.ttf",
  ],
  [
    "truetype/freefont/FreeMono.ttf",
    "truetype/freefont/FreeMonoBold.ttf",
    "truetype/freefont/FreeMonoOblique.ttf",
    "truetype/freefont/FreeMonoBoldOblique.ttf",
  ],
];

/** Returns the first file path that exists on the filesystem. */
function findFirst(relativePaths: string[]): string | undefined {
  for (const rel of relativePaths) {
    // Try against each known base directory
    for (const base of ["/usr/share/fonts", "/usr/local/share/fonts", "/Library/Fonts"]) {
      const full = path.join(base, rel);
      if (fs.existsSync(full)) return full;
    }
    // Also try absolute direct path
    if (path.isAbsolute(rel) && fs.existsSync(rel)) return rel;
  }
  return undefined;
}

/** Resolves a [regular, bold, italic, boldItalic] candidate group into found paths. */
function resolveCandidateGroup(
  candidates: [string, string, string, string][],
): SystemFontVariant | null {
  for (const [reg, bold, ital, boldItal] of candidates) {
    const regularPath = findFirst([reg]);
    if (!regularPath) continue;

    const result: SystemFontVariant = { regular: regularPath };

    const boldPath = findFirst([bold]);
    if (boldPath) result.bold = boldPath;

    const italPath = findFirst([ital]);
    if (italPath) result.italic = italPath;

    const boldItalPath = findFirst([boldItal]);
    if (boldItalPath) result.boldItalic = boldItalPath;

    return result;
  }
  return null;
}

export interface DiscoveredSystemFonts {
  /** Liberation Sans / DejaVu Sans / FreeSans — maps to: Helvetica, Arial, sans-serif */
  sansSerif: SystemFontVariant | null;
  /** Liberation Serif / DejaVu Serif / FreeSerif — maps to: Times-Roman, serif */
  serif: SystemFontVariant | null;
  /** Liberation Mono / DejaVu Mono / FreeMono — maps to: Courier, monospace */
  mono: SystemFontVariant | null;
}

let _cached: DiscoveredSystemFonts | null = null;

/**
 * Discovers available system fonts once and returns the results (cached).
 * Performs synchronous filesystem checks — call once at startup.
 */
export function discoverSystemFonts(): DiscoveredSystemFonts {
  if (_cached) return _cached;

  _cached = {
    sansSerif: resolveCandidateGroup(SANS_SERIF_CANDIDATES),
    serif: resolveCandidateGroup(SERIF_CANDIDATES),
    mono: resolveCandidateGroup(MONO_CANDIDATES),
  };

  return _cached;
}

/** Resets the system font cache (for testing). */
export function resetSystemFontCache(): void {
  _cached = null;
}
