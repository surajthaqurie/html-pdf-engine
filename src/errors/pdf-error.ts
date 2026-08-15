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
    super(message.startsWith("ImageError:") ? message : `ImageError: ${message}`);
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
    super(
      `HtmlParseError: ${message}${line ? ` at line ${line}:${column}` : ""}`,
    );
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
    super(
      `CssParseError: ${message}${line ? ` at line ${line}:${column}` : ""}`,
    );
    this.name = "CssParseError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LayoutError extends PdfError {
  constructor(
    message: string,
    public readonly elementTag?: string,
  ) {
    super(`LayoutError: ${message}${elementTag ? ` in <${elementTag}>` : ""}`);
    this.name = "LayoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnsupportedFeatureError extends PdfError {
  constructor(feature: string, context?: string) {
    super(
      `UnsupportedFeatureError: "${feature}" is not supported${context ? ` (${context})` : ""}`,
    );
    this.name = "UnsupportedFeatureError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
