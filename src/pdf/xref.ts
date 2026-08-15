export interface XRefEntry {
  objectNumber: number;
  offset: number;
  generationNumber: number;
  inUse: boolean;
}

export class XRefTable {
  private entries: Map<number, XRefEntry> = new Map();

  constructor() {
    // Object 0 is always entry 0 in xref
    this.addEntry(0, 0, 65535, false);
  }

  addEntry(
    objectNumber: number,
    offset: number,
    generationNumber = 0,
    inUse = true,
  ): void {
    this.entries.set(objectNumber, {
      objectNumber,
      offset,
      generationNumber,
      inUse,
    });
  }

  get size(): number {
    if (this.entries.size === 0) return 0;
    const maxObj = Math.max(...Array.from(this.entries.keys()));
    return maxObj + 1;
  }

  toBytes(): Uint8Array {
    const size = this.size;
    const lines: string[] = ["xref", `0 ${size}`];

    for (let i = 0; i < size; i++) {
      const entry = this.entries.get(i) ?? {
        objectNumber: i,
        offset: 0,
        generationNumber: 65535,
        inUse: false,
      };

      const offsetStr = entry.offset.toString().padStart(10, "0");
      const genStr = entry.generationNumber.toString().padStart(5, "0");
      const flag = entry.inUse ? "n" : "f";

      // Fixed 20-byte line: 10 + 1 + 5 + 1 + 1 + 2 (\r\n) = 20 bytes
      lines.push(`${offsetStr} ${genStr} ${flag} \r`);
    }

    // Join with \n so each line ends in \r\n
    return new TextEncoder().encode(lines.join("\n") + "\n");
  }
}
