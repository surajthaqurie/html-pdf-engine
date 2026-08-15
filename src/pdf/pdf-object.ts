const ENCODER = new TextEncoder();

export type PDFValue =
  | PDFNull
  | PDFBoolean
  | PDFNumber
  | PDFString
  | PDFName
  | PDFArray
  | PDFDictionary
  | PDFRef;

export class PDFNull {
  toString(): string {
    return "null";
  }
  toBytes(): Uint8Array {
    return ENCODER.encode(this.toString());
  }
}

export class PDFBoolean {
  constructor(public readonly value: boolean) {}
  toString(): string {
    return this.value ? "true" : "false";
  }
  toBytes(): Uint8Array {
    return ENCODER.encode(this.toString());
  }
}

export class PDFNumber {
  constructor(public readonly value: number) {}
  toString(): string {
    // Format to max 4 decimal places, trimming trailing zeros
    if (Number.isInteger(this.value)) {
      return this.value.toString();
    }
    const fixed = this.value.toFixed(4);
    return parseFloat(fixed).toString();
  }
  toBytes(): Uint8Array {
    return ENCODER.encode(this.toString());
  }
}

export class PDFName {
  public readonly name: string;
  constructor(name: string) {
    // Ensure name starts with '/'
    this.name = name.startsWith("/") ? name : `/${name}`;
  }
  toString(): string {
    return this.name;
  }
  toBytes(): Uint8Array {
    return ENCODER.encode(this.toString());
  }
}

export function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\x08/g, "\\b")
    .replace(/\x0c/g, "\\f");
}

export class PDFString {
  constructor(
    public readonly value: string,
    public readonly isHex: boolean = false,
  ) {}

  static escapeLiteral(str: string): string {
    return escapePdfString(str);
  }

  private hasNonAscii(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 127) return true;
    }
    return false;
  }

  toString(): string {
    if (this.isHex) {
      if (/^[0-9a-fA-F]*$/.test(this.value)) {
        return `<${this.value.toUpperCase()}>`;
      }
      const hex = Array.from(new TextEncoder().encode(this.value))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
      return `<${hex}>`;
    }
    if (this.hasNonAscii(this.value)) {
      let hex = "FEFF";
      for (let i = 0; i < this.value.length; i++) {
        const code = this.value.charCodeAt(i);
        hex += code.toString(16).padStart(4, "0").toUpperCase();
      }
      return `<${hex}>`;
    }
    return `(${PDFString.escapeLiteral(this.value)})`;
  }

  toBytes(): Uint8Array {
    return ENCODER.encode(this.toString());
  }
}

export class PDFRef {
  constructor(
    public readonly objectNumber: number,
    public readonly generationNumber: number = 0,
  ) {}
  toString(): string {
    return `${this.objectNumber} ${this.generationNumber} R`;
  }
  toBytes(): Uint8Array {
    return ENCODER.encode(this.toString());
  }
}

export class PDFArray {
  constructor(public readonly items: PDFValue[] = []) {}

  push(item: PDFValue): void {
    this.items.push(item);
  }

  toString(): string {
    return `[ ${this.items.map((i) => i.toString()).join(" ")} ]`;
  }

  toBytes(): Uint8Array {
    return ENCODER.encode(this.toString());
  }
}

export class PDFDictionary {
  private readonly map: Map<string, PDFValue> = new Map();

  constructor(entries?: Record<string, PDFValue>) {
    if (entries) {
      for (const [key, value] of Object.entries(entries)) {
        this.set(key, value);
      }
    }
  }

  set(key: string, value: PDFValue): void {
    const formattedKey = key.startsWith("/") ? key : `/${key}`;
    this.map.set(formattedKey, value);
  }

  get(key: string): PDFValue | undefined {
    const formattedKey = key.startsWith("/") ? key : `/${key}`;
    return this.map.get(formattedKey);
  }

  has(key: string): boolean {
    const formattedKey = key.startsWith("/") ? key : `/${key}`;
    return this.map.has(formattedKey);
  }

  entries(): [string, PDFValue][] {
    return Array.from(this.map.entries());
  }

  toString(): string {
    const lines: string[] = ["<<"];
    for (const [key, val] of this.map.entries()) {
      lines.push(`  ${key} ${val.toString()}`);
    }
    lines.push(">>");
    return lines.join("\n");
  }

  toBytes(): Uint8Array {
    return ENCODER.encode(this.toString());
  }
}

const ENDOBJ_BYTES = new Uint8Array([10, 101, 110, 100, 111, 98, 106, 10]); // \nendobj\n

export class PDFIndirectObject {
  constructor(
    public readonly objectNumber: number,
    public readonly value: PDFValue,
    public readonly generationNumber: number = 0,
  ) {}

  get ref(): PDFRef {
    return new PDFRef(this.objectNumber, this.generationNumber);
  }

  toBytes(): Uint8Array {
    const header = ENCODER.encode(
      `${this.objectNumber} ${this.generationNumber} obj\n`,
    );
    const valBytes = this.value.toBytes();

    const totalLength = header.length + valBytes.length + ENDOBJ_BYTES.length;
    const result = new Uint8Array(totalLength);
    result.set(header, 0);
    result.set(valBytes, header.length);
    result.set(ENDOBJ_BYTES, header.length + valBytes.length);

    return result;
  }
}
