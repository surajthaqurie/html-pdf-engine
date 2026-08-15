export type Specificity = [number, number, number, number];

const ID_REGEX = /#[a-zA-Z0-9_-]+/g;
const CLASS_REGEX = /\.[a-zA-Z0-9_-]+/g;
const TAG_REGEX = /^[a-zA-Z0-9_-]+/;

export function calculateSpecificity(
  selector: string,
  isInline = false,
): Specificity {
  if (isInline) return [1, 0, 0, 0];

  let idCount = 0;
  let classCount = 0;
  let elementCount = 0;

  const parts = selector.trim().split(/\s+/);

  for (const part of parts) {
    if (part === "*") continue;

    ID_REGEX.lastIndex = 0;
    const ids = part.match(ID_REGEX);
    if (ids) idCount += ids.length;

    CLASS_REGEX.lastIndex = 0;
    const classes = part.match(CLASS_REGEX);
    if (classes) classCount += classes.length;

    TAG_REGEX.lastIndex = 0;
    const tagMatch = part.match(TAG_REGEX);
    if (tagMatch) elementCount += 1;
  }

  return [0, idCount, classCount, elementCount];
}

export function compareSpecificity(a: Specificity, b: Specificity): number {
  for (let i = 0; i < 4; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
