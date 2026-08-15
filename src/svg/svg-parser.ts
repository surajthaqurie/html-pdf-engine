import { SvgElementNode } from "./svg-node.js";
import { TextNode } from "../html/dom/node.js";
import { SvgError } from "../errors/pdf-error.js";

function decodeEntities(str: string): string {
  return str.replace(/&([^;]+);/g, (match, entity) => {
    if (entity === "lt") return "<";
    if (entity === "gt") return ">";
    if (entity === "amp") return "&";
    if (entity === "quot") return '"';
    if (entity === "apos") return "'";
    if (entity.startsWith("#x")) {
      const code = parseInt(entity.slice(2), 16);
      return isNaN(code) ? match : String.fromCharCode(code);
    }
    if (entity.startsWith("#")) {
      const code = parseInt(entity.slice(1), 10);
      return isNaN(code) ? match : String.fromCharCode(code);
    }
    return match; // Ignore/do not resolve unknown entities to prevent Billion Laughs
  });
}

export class SvgParser {
  parse(xmlStr: string): SvgElementNode {
    let i = 0;
    const len = xmlStr.length;
    const stack: SvgElementNode[] = [];
    let rootSvg: SvgElementNode | null = null;

    const skipWhitespace = () => {
      while (i < len && /\s/.test(xmlStr[i]!)) i++;
    };

    while (i < len) {
      skipWhitespace();
      if (i >= len) break;

      if (xmlStr[i] === "<") {
        if (xmlStr.startsWith("<!--", i)) {
          i = parseComment(xmlStr, i);
        } else if (
          xmlStr.startsWith("<!DOCTYPE", i) ||
          xmlStr.startsWith("<!ELEMENT", i) ||
          xmlStr.startsWith("<!ENTITY", i) ||
          xmlStr.startsWith("<!ATTLIST", i)
        ) {
          i = parseDoctype(xmlStr, i);
        } else if (xmlStr.startsWith("<?", i)) {
          i = parseProcessingInstruction(xmlStr, i);
        } else if (xmlStr[i + 1] === "/") {
          i = parseEndTag(xmlStr, i, len, stack);
        } else {
          const result = parseStartTag(xmlStr, i, len, stack, rootSvg);
          i = result.nextIndex;
          if (result.rootSvg) rootSvg = result.rootSvg;
        }
      } else {
        i = parseTextNode(xmlStr, i, len, stack);
      }
    }

    if (stack.length > 0) {
      throw new SvgError(
        `Malformed SVG: unclosed tag '${stack.at(-1)!.tagName}'`,
      );
    }
    if (!rootSvg) {
      throw new SvgError("Malformed SVG: missing root <svg> element");
    }
    return rootSvg;
  }
}

function parseComment(xmlStr: string, i: number): number {
  const endIdx = xmlStr.indexOf("-->", i + 4);
  if (endIdx === -1) {
    throw new SvgError("Malformed SVG: unclosed comment");
  }
  return endIdx + 3;
}

function parseDoctype(xmlStr: string, i: number): number {
  const endIdx = xmlStr.indexOf(">", i);
  if (endIdx === -1) {
    throw new SvgError("Malformed SVG: unclosed DTD declaration");
  }
  return endIdx + 1;
}

function parseProcessingInstruction(
  xmlStr: string,
  i: number,
): number {
  const endIdx = xmlStr.indexOf("?>", i + 2);
  if (endIdx === -1) {
    throw new SvgError("Malformed SVG: unclosed processing instruction");
  }
  return endIdx + 2;
}

function parseEndTag(
  xmlStr: string,
  i: number,
  len: number,
  stack: SvgElementNode[],
): number {
  i += 2; // skip </
  const tagName = readTagName(xmlStr, i, len);
  i = tagName.nextIndex;
  i = skipWhitespace(xmlStr, i, len);
  if (xmlStr[i] !== ">") {
    throw new SvgError(
      `Malformed SVG: expected '>' in closing tag '${tagName.name}'`,
    );
  }
  i++; // skip >

  if (tagName.name === "script") {
    return i;
  }

  if (stack.length === 0) {
    throw new SvgError(
      `Malformed SVG: unmatched closing tag '${tagName.name}'`,
    );
  }
  const currentParent = stack.at(-1)!;
  if (currentParent.tagName !== tagName.name) {
    throw new SvgError(
      `Malformed SVG: tag mismatch, expected closing tag for '${currentParent.tagName}' but found '${tagName.name}'`,
    );
  }
  stack.pop();
  return i;
}

function parseStartTag(
  xmlStr: string,
  i: number,
  len: number,
  stack: SvgElementNode[],
  rootSvg: SvgElementNode | null,
): { nextIndex: number; rootSvg: SvgElementNode | null } {
  i++; // skip <
  const tagName = readTagName(xmlStr, i, len);
  i = tagName.nextIndex;
  if (!tagName.name) {
    throw new SvgError("Malformed SVG: tag name is missing");
  }

  const attributes = parseAttributes(xmlStr, i, len, tagName.name);
  i = attributes.nextIndex;

  let selfClosing = false;
  i = skipWhitespace(xmlStr, i, len);
  if (xmlStr[i] === "/" && xmlStr[i + 1] === ">") {
    selfClosing = true;
    i += 2;
  } else if (xmlStr[i] === ">") {
    i++;
  } else {
    throw new SvgError(
      `Malformed SVG: expected '>' or '/>' in tag '${tagName.name}'`,
    );
  }

  if (tagName.name === "script") {
    if (!selfClosing) {
      const scriptEnd = xmlStr.indexOf("</script>", i);
      i = scriptEnd !== -1 ? scriptEnd + 9 : len;
    }
    return { nextIndex: i, rootSvg };
  }

  const elem = new SvgElementNode(tagName.name, attributes.attrs);

  if (stack.length > 0) {
    stack.at(-1)!.appendChild(elem);
  } else if (tagName.name === "svg") {
    if (rootSvg) {
      throw new SvgError("Malformed SVG: multiple root svg elements found");
    }
    rootSvg = elem;
  }

  if (!selfClosing) {
    if (stack.length >= 250) {
      throw new SvgError("Malformed SVG: nesting depth exceeded limit");
    }
    stack.push(elem);
  }

  return { nextIndex: i, rootSvg };
}

function parseAttributes(
  xmlStr: string,
  i: number,
  len: number,
  tagName: string,
): { attrs: Record<string, string>; nextIndex: number } {
  const attrs: Record<string, string> = {};

  while (i < len) {
    i = skipWhitespace(xmlStr, i, len);
    if (
      i >= len ||
      xmlStr[i] === ">" ||
      (xmlStr[i] === "/" && xmlStr[i + 1] === ">")
    ) {
      break;
    }

    const attrName = readAttributeName(xmlStr, i, len, tagName);
    i = attrName.nextIndex;
    i = skipWhitespace(xmlStr, i, len);
    if (xmlStr[i] !== "=") {
      throw new SvgError(
        `Malformed SVG: expected '=' after attribute name '${attrName.name}' inside tag '${tagName}'`,
      );
    }
    i++; // skip =
    i = skipWhitespace(xmlStr, i, len);

    const quoteChar = xmlStr[i]!;
    if (quoteChar !== '"' && quoteChar !== "'") {
      throw new SvgError(
        `Malformed SVG: expected quote around value of attribute '${attrName.name}' inside tag '${tagName}'`,
      );
    }
    i++; // skip quote
    const endAttrVal = xmlStr.indexOf(quoteChar, i);
    if (endAttrVal === -1) {
      throw new SvgError(
        `Malformed SVG: unclosed value for attribute '${attrName.name}' inside tag '${tagName}'`,
      );
    }
    const attrVal = decodeEntities(xmlStr.slice(i, endAttrVal));
    i = endAttrVal + 1;

    if (attrName.name.startsWith("on")) {
      continue;
    }
    if (attrVal.trim().toLowerCase().startsWith("javascript:")) {
      continue;
    }

    attrs[attrName.name] = attrVal;
  }

  return { attrs, nextIndex: i };
}

function readTagName(
  xmlStr: string,
  i: number,
  len: number,
): { name: string; nextIndex: number } {
  const start = i;
  while (i < len && /[a-zA-Z0-9_:-]/.test(xmlStr[i]!)) i++;
  return { name: xmlStr.slice(start, i).toLowerCase(), nextIndex: i };
}

function readAttributeName(
  xmlStr: string,
  i: number,
  len: number,
  tagName: string,
): { name: string; nextIndex: number } {
  const start = i;
  while (i < len && /[a-zA-Z0-9_:-]/.test(xmlStr[i]!)) i++;
  const name = xmlStr.slice(start, i).toLowerCase();
  if (!name) {
    throw new SvgError(
      `Malformed SVG: invalid attribute name inside tag '${tagName}'`,
    );
  }
  return { name, nextIndex: i };
}

function skipWhitespace(xmlStr: string, i: number, len: number): number {
  while (i < len && /\s/.test(xmlStr[i]!)) i++;
  return i;
}

function parseTextNode(
  xmlStr: string,
  i: number,
  len: number,
  stack: SvgElementNode[],
): number {
  const startText = i;
  const nextLt = xmlStr.indexOf("<", i);
  const endText = nextLt === -1 ? len : nextLt;
  const textVal = decodeEntities(xmlStr.slice(startText, endText));
  i = endText;

  if (stack.length > 0) {
    const parent = stack.at(-1)!;
    if (parent.tagName === "style" || textVal.trim()) {
      parent.appendChild(new TextNode(textVal));
    }
  }
  return i;
}
