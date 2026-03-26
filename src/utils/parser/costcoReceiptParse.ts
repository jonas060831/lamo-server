interface ParsedItem {
  number: string;
  name: string;
  price: number;
  quantity: number;
}

interface ParsedReceipt {
  owner: string;
  company: string;
  storeNumber?: string;
  rawText: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  items: ParsedItem[];
  date?: string;
  totalItemsSold?: number;
}

// ─── Regex constants ──────────────────────────────────────────────────────────

// Void/return adjustment lines: "0000375792 / 2218574 4.00-A"
const VOID_ADJUSTMENT_RE = /^\d[\d\s]+\/\s*\d+\s+[\d,.]+[-]\w?$/;

// A valid item line (with optional leading tax-code letter like "E"):
//   [optional "E "] <6-12 digit item#> <whitespace> <name> <2+ spaces> <price> [optional tax letter]
// Price must NOT have a trailing minus (those are void adjustments).
const ITEM_LINE_RE =
  /^(?:[A-Z]\s+)?(\d{6,12})\s{1,}(.{2,}?)\s{2,}([\d,.]+)\s*([A-Z]?)$/;

// Quantity line: "10 @ 1.50"
const QTY_LINE_RE = /^(\d+)\s*@\s*([\d,.]+)$/;

// Member line: "61 Member XXXXXXXXXXXX"
const MEMBER_LINE_RE = /^\d{1,3}\s+Member\s+\d+/i;

// Once we see any of these we are past the items section
const FOOTER_START_RE =
  /^(\*+\s*TOTAL|\bSUBTOTAL\b|\bTOTAL\s+TAX\b|XXXX+|AID:|Seq#|Costco\s+Visa|APPROVED|AMOUNT:|CHANGE|TOTAL\s+NUMBER|INSTANT\s+SAVINGS|Concession|OP#|Thank\s+You|Please\s+Come|Whse:|Items\s+Sold)/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMoney(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function cleanOcr(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n");
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const costcoReceiptParser = (rawText: string, ownerId: string): ParsedReceipt => {
  const cleanText = cleanOcr(rawText);
  const allLines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);

  // ── 0. Company name ───────────────────────────────────────────────────────
  const company = allLines[0]?.toLowerCase() ?? "";

  // ── 1. Store number — from "El Camino #475" line ─────────────────────────
  const storeMatch =
    cleanText.match(/El\s+Camino\s+#(\d+)/i) ?? cleanText.match(/#(\d+)/);
  const storeNumber = storeMatch?.[1];

  // ── 2. Skip header block ──────────────────────────────────────────────────
  // Header = company name + "El Camino #NNN" + address lines + phone + member line.
  // We skip everything up to and including the member line.
  let itemStartIdx = 0;
  for (let i = 0; i < allLines.length; i++) {
    if (MEMBER_LINE_RE.test(allLines[i])) {
      itemStartIdx = i + 1;
      break;
    }
  }

  // ── 3. Collect item-region lines ──────────────────────────────────────────
  // Stop at the footer. Also skip void-block lines and adjustment lines.
  const itemLines: string[] = [];
  let inVoidBlock = false;

  for (let i = itemStartIdx; i < allLines.length; i++) {
    const line = allLines[i];

    if (FOOTER_START_RE.test(line)) break;

    // "VOID" heading on its own line — everything until the next real item is
    // part of the void block (items being cancelled, not purchased)
    if (/^VOID\s*$/i.test(line)) {
      inVoidBlock = true;
      continue;
    }

    // Void adjustment lines like "0000375792 / 2218574   4.00-A"
    if (VOID_ADJUSTMENT_RE.test(line)) continue;

    // Inside a VOID block: skip until we see an item-number line again
    if (inVoidBlock) {
      if (ITEM_LINE_RE.test(line)) {
        inVoidBlock = false; // resume normal parsing
      } else {
        continue;
      }
    }

    itemLines.push(line);
  }

  // ── 4. Financial summary ──────────────────────────────────────────────────
  const subtotalMatch = cleanText.match(/\bSUBTOTAL\b[:\s]*\$?([\d,.]+)/i);
  const taxMatch      = cleanText.match(/\bTax\b[:\s]*([\d,.]+)/i);
  // Costco prints "**** TOTAL  452.12" — match stars + TOTAL
  const totalMatch =
    cleanText.match(/\*+\s*TOTAL[:\s]*\$?([\d,.]+)/i) ??
    cleanText.match(/AMOUNT:\s*\$?([\d,.]+)/i);

  const subtotal = subtotalMatch ? parseMoney(subtotalMatch[1]) : undefined;
  const tax      = taxMatch      ? parseMoney(taxMatch[1])      : undefined;
  const total    = totalMatch    ? parseMoney(totalMatch[1])    : undefined;

  // ── 5. Parse items ────────────────────────────────────────────────────────
  const items: ParsedItem[] = [];

  for (let i = 0; i < itemLines.length; i++) {
    const line = itemLines[i];
    const match = ITEM_LINE_RE.exec(line);
    if (!match) continue;

    const number = match[1];
    let name     = match[2].trim();
    const price  = parseMoney(match[3]);

    if (price <= 0) continue;

    // Multi-line name continuation?
    if (i + 1 < itemLines.length) {
      const next = itemLines[i + 1].trim();
      if (
        !ITEM_LINE_RE.test(next) &&
        !QTY_LINE_RE.test(next) &&
        !/^\d{6,}/.test(next) &&
        !/[\d,.]+\s*[A-Z]?$/.test(next)
      ) {
        name += " " + next;
        i++;
      }
    }

    // Quantity line? e.g. "10 @ 1.50"
    let quantity = 1;
    if (i + 1 < itemLines.length) {
      const qtyMatch = QTY_LINE_RE.exec(itemLines[i + 1].trim());
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
        i++;
      }
    }

    items.push({ number, name, price, quantity });
  }

  // ── 6. Date ───────────────────────────────────────────────────────────────
  const dateRegex = /\b(\d{2}\/\d{2}\/(?:\d{2}|\d{4})\s+\d{2}:\d{2})\b/g;
  const dateMatches = [...cleanText.matchAll(dateRegex)];
  const date = dateMatches.length
    ? dateMatches[dateMatches.length - 1][1]
    : undefined;

  // ── 7. Total items sold ───────────────────────────────────────────────────
  const totalItemsMatch =
    cleanText.match(/TOTAL\s+NUMBER\s+OF\s+[A-Z\s]*SOLD[:\s=-]*(\d+)/i) ??
    cleanText.match(/Items?\s+Sold[:\s]*(\d+)/i);
  const totalItemsSold = totalItemsMatch
    ? parseInt(totalItemsMatch[1], 10)
    : undefined;

  return {
    owner: ownerId,
    company,
    storeNumber,
    rawText,
    subtotal,
    tax,
    total,
    items,
    date,
    totalItemsSold,
  };
};

export default costcoReceiptParser;