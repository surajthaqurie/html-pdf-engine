export class PdfError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    const formattedMessage = message.startsWith("PdfError:")
      ? message
      : `PdfError: ${message}`;
    super(formattedMessage);
    this.name = "PdfError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FontError extends PdfError {
  constructor(message: string) {
    super(message.startsWith("FontError:") ? message : `FontError: ${message}`);
    this.name = "FontError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ImageError extends PdfError {
  constructor(message: string) {
    super(
      message.startsWith("ImageError:") ? message : `ImageError: ${message}`,
    );
    this.name = "ImageError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class HtmlParseError extends PdfError {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    const loc = line ? ` at line ${line}:${column}` : "";
    super(`HtmlParseError: ${message}${loc}`);
    this.name = "HtmlParseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CssParseError extends PdfError {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    const loc = line ? ` at line ${line}:${column}` : "";
    super(`CssParseError: ${message}${loc}`);
    this.name = "CssParseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LayoutError extends PdfError {
  constructor(
    message: string,
    public readonly elementTag?: string,
  ) {
    const tagInfo = elementTag ? ` in <${elementTag}>` : "";
    super(`LayoutError: ${message}${tagInfo}`);
    this.name = "LayoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnsupportedFeatureError extends PdfError {
  constructor(feature: string, context?: string) {
    const ctxInfo = context ? ` (${context})` : "";
    super(`UnsupportedFeatureError: "${feature}" is not supported${ctxInfo}`);
    this.name = "UnsupportedFeatureError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SvgError extends PdfError {
  constructor(message: string) {
    super(message.startsWith("SvgError:") ? message : `SvgError: ${message}`);
    this.name = "SvgError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
