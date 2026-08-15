import { HTMLTokenizer } from "./tokenizer.js";
import {
  DocumentNode,
  ElementNode,
  TextNode,
  CommentNode,
  BaseNode,
} from "./dom/node.js";

export class HTMLParser {
  parse(html: string): DocumentNode {
    const tokenizer = new HTMLTokenizer(html);
    const tokens = tokenizer.tokenize();
    const doc = new DocumentNode();
    const stack: BaseNode[] = [doc];

    for (const token of tokens) {
      const currentParent = stack[stack.length - 1] ?? doc;

      if (token.type === "StartTag" && token.tagName) {
        const elem = new ElementNode(token.tagName, token.attributes ?? {});
        currentParent.appendChild(elem);

        if (!token.selfClosing) {
          stack.push(elem);
        }
      } else if (token.type === "EndTag" && token.tagName) {
        // Pop stack until matching tag is found (auto-recovering malformed tags)
        for (let i = stack.length - 1; i > 0; i--) {
          const node = stack[i];
          if (node instanceof ElementNode && node.tagName === token.tagName) {
            stack.splice(i);
            break;
          }
        }
      } else if (token.type === "Text" && token.text !== undefined) {
        // Skip whitespace-only text nodes between block elements, but preserve inline text space
        const textNode = new TextNode(token.text);
        currentParent.appendChild(textNode);
      } else if (token.type === "Comment" && token.text !== undefined) {
        const commentNode = new CommentNode(token.text);
        currentParent.appendChild(commentNode);
      }
    }

    return doc;
  }
}
