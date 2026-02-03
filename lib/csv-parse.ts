/**
 * Minimal CSV parser for import: UTF-8, comma delimiter, quoted fields.
 * Handles "" inside quoted fields. Returns array of string[] (one per row).
 */
export function parseCsvLines(csvText: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let i = 0;
  const len = csvText.length;

  function takeField(): string {
    if (i >= len) return "";
    if (csvText[i] === '"') {
      i += 1;
      let value = "";
      while (i < len) {
        if (csvText[i] === '"') {
          i += 1;
          if (i < len && csvText[i] === '"') {
            value += '"';
            i += 1;
          } else {
            break;
          }
        } else {
          value += csvText[i];
          i += 1;
        }
      }
      return value;
    }
    let value = "";
    while (i < len && csvText[i] !== "," && csvText[i] !== "\n" && csvText[i] !== "\r") {
      value += csvText[i];
      i += 1;
    }
    return value;
  }

  while (i < len) {
    const field = takeField().trim();
    current.push(field);
    if (i < len && (csvText[i] === "\n" || csvText[i] === "\r")) {
      if (csvText[i] === "\r" && csvText[i + 1] === "\n") i += 2;
      else i += 1;
      rows.push(current);
      current = [];
    } else if (i < len && csvText[i] === ",") {
      i += 1;
    }
  }
  if (current.length > 0) rows.push(current);
  return rows;
}
