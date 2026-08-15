export enum NodeType {
  DOCUMENT = 9,
  ELEMENT = 1,
  TEXT = 3,
  COMMENT = 8,
}

export abstract class BaseNode {
  abstract readonly nodeType: NodeType;
  parent: BaseNode | null = null;
  children: BaseNode[] = [];

  appendChild(child: BaseNode): void {
    child.parent = this;
    this.children.push(child);
  }

  querySelector(selector: string): ElementNode | null {
    const results = this.querySelectorAll(selector);
    return results[0] ?? null;
  }

  querySelectorAll(selector: string): ElementNode[] {
    const results: ElementNode[] = [];
    const targetTag = selector.toLowerCase();

    const traverse = (node: BaseNode) => {
      if (node instanceof ElementNode) {
        if (selector.startsWith(".")) {
          const className = selector.slice(1);
          if (node.classList.includes(className)) results.push(node);
        } else if (selector.startsWith("#")) {
          const idName = selector.slice(1);
          if (node.id === idName) results.push(node);
        } else if (node.tagName === targetTag || selector === "*") {
          results.push(node);
        }
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(this);
    return results;
  }
}

export class DocumentNode extends BaseNode {
  readonly nodeType = NodeType.DOCUMENT;
}

export class ElementNode extends BaseNode {
  readonly nodeType = NodeType.ELEMENT;
  attributes: Record<string, string> = {};

  constructor(
    public tagName: string,
    attributes: Record<string, string> = {},
  ) {
    super();
    this.tagName = tagName.toLowerCase();
    this.attributes = attributes;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name.toLowerCase()] ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name.toLowerCase()] = value;
  }

  hasAttribute(name: string): boolean {
    return name.toLowerCase() in this.attributes;
  }

  get classList(): string[] {
    const classAttr = this.getAttribute("class");
    if (!classAttr) return [];
    return classAttr.trim().split(/\s+/);
  }

  get id(): string {
    return this.getAttribute("id") ?? "";
  }
}

export class TextNode extends BaseNode {
  readonly nodeType = NodeType.TEXT;
  constructor(public text: string) {
    super();
  }
}

export class CommentNode extends BaseNode {
  readonly nodeType = NodeType.COMMENT;
  constructor(public text: string) {
    super();
  }
}
