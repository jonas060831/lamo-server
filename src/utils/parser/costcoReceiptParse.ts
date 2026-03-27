/**
 * costcoReceiptParser.ts
 *
 * Costco receipts are two-column thermal prints. OCR engines (Tesseract etc.)
 * often interleave or split those columns, so the raw text lines rarely look like
 * "itemNumber  name  price" on a single row.  Instead we see patterns like:
 *
 *   "22185574  SWIFFER Wey  503"   ← item# + name + mangled price (26.99 → "503" OCR noise)
 *   "0000375792 / 2218574"         ← void/return adjustment  (skip)
 *   "E 1895737  KS BABY. WIPE:"    ← tax-coded item, no price on this line
 *   "9.00"                         ← price on its own line (for a multi-line item)
 *
 * Strategy
 * ─────────
 * 1. Strip the header (everything up to & including the Member line).
 * 2. Walk lines until the footer keywords appear.
 * 3. For each line try to extract an item number.  If found, accumulate
 *    the name tokens from the same line.  The price may be:
 *    (a) on the same line — last token that looks like NN.NN
 *    (b) on the very next line that contains ONLY a price
 * 4. Skip void-adjustment lines (contain " / " between two digit blocks).
 * 5. Skip lines inside a VOID block heading.
 * 6. Financial totals: "SUBTOTAL", "TAX", and "*** TOTAL" / "AMOUNT:" lines.
 */

import { ParsedItem, ParsedReceipt } from "../../models/receipt";
import { Schema } from 'mongoose'




// ─── Regex constants ──────────────────────────────────────────────────────────

/** Void / return-adjustment lines: digits  /  digits  price[-][letter] */
const VOID_ADJ_RE = /^\d[\d\s]+\/\s*\d+(\s+[\d,.]+[-]\w?)?$/;

/** Member line at top of receipt: "61 Member 111968790056" */
const MEMBER_LINE_RE = /^\d{1,3}\s+Member\s+\d+/i;

/**
 * An item number: 3–12 consecutive digits.
 * We allow an optional leading tax-code letter "E " before it.
 * Costco item numbers can be as short as 3 digits (e.g. "206").
 */
const ITEM_NUM_RE = /^(?:[A-Z]\s+)?(\d{3,12})(?:\s|$)/;

/**
 * A price token: digits with optional comma-thousands and exactly 2 decimal places.
 * Must NOT be followed by a minus sign (that would be a void adjustment).
 */
const PRICE_TOKEN_RE = /^([\d,]+\.\d{2})([A-Z]{0,2})?$/;

/**
 * A standalone price-only line (the whole trimmed line is just a price,
 * possibly with a trailing tax-code letter).
 */
const PRICE_ONLY_LINE_RE = /^([\d,]+\.\d{2})\s*([A-Z]{0,2})?$/;

/** Quantity line: "10 @ 1.50" */
const QTY_LINE_RE = /^(\d+)\s*@\s*([\d,.]+)$/;

/**
 * Footer trigger — once we see any of these the items section is over.
 * "SUBT" catches both "SUBTOTAL" and mangled versions like "SUET".
 */
const FOOTER_RE =
  /^(SUBT|SUET|SUB\s*TOTAL|\*+\s*TOTAL|\bTOTAL\s+TAX|XXXX+|AID:|Seq#|Sea#|Costco\s+Visa|APPROVED|AMOUNT:|CHANGE\b|TOTAL\s+NUMBER|INSTANT\s+SAVINGS|Concession|OP#|Thank\s+You|Please\s+Come|Whse:|Items\s+Sold)/i;

/** VOID block heading */
const VOID_HEADING_RE = /^VOID\s*$/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMoney(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function cleanOcr(raw: string): string {
  return raw
    .replace(/\r/g, "")
    // Keep printable ASCII + newlines; strip control chars and multi-byte noise
    .replace(/[^\x20-\x7E\n]/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n");
}

/**
 * Given the tokens on a line (after the item number), extract the name and
 * the price (if present on this line).
 *
 * Costco lines look like:
 *   SWIFFER WET  26.99 A
 *   KS BABY WIPE             ← no price; will be on next line
 *   HUGGIES SZ 5  49.99
 *
 * We scan from the right: if the last token (ignoring a trailing tax letter)
 * looks like a price, we use it.  Everything else is the name.
 */
function extractNameAndPrice(
  tokens: string[]
): { name: string; price: number | null } {
  if (tokens.length === 0) return { name: "", price: null };

  // Drop a trailing single tax-code letter token like "A" or "AF"
  let end = tokens.length - 1;
  if (/^[A-Z]{1,2}$/.test(tokens[end]) && end > 0) end--;

  const candidate = tokens[end];
  const priceMatch = PRICE_TOKEN_RE.exec(candidate);

  if (priceMatch) {
    const price = parseMoney(priceMatch[1]);
    const name = tokens
      .slice(0, end)
      .join(" ")
      .trim();
    return { name, price };
  }

  return { name: tokens.join(" ").trim(), price: null };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

const costcoReceiptParser = (rawText: string, ownerId: Schema.Types.ObjectId): ParsedReceipt => {
  const cleanText = cleanOcr(rawText);
  const allLines = cleanText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // ── 0. Company name ───────────────────────────────────────────────────────
  // First non-empty line (typically "COSTCO WHOLESALE" or OCR noise of it)
  const company: any = allLines[0]?.toLowerCase() ?? "";

  // ── 1. Store number ───────────────────────────────────────────────────────
  // Look for "El Camino #475" or generic "#NNN"
  const storeMatch =
    cleanText.match(/El\s+Camino\s+#(\d+)/i) ??
    cleanText.match(/#(\d+)/);
  const storeNumber = storeMatch?.[1] || "-1";

  // ── 2. Find where item lines start ───────────────────────────────────────
  // Skip header: company + store name/address + phone + member line
  let itemStartIdx = 0;
  for (let i = 0; i < allLines.length; i++) {
    if (MEMBER_LINE_RE.test(allLines[i])) {
      itemStartIdx = i + 1;
      break;
    }
  }

  // ── 3. Collect the item region ────────────────────────────────────────────
  const itemLines: string[] = [];
  let inVoidBlock = false;

  for (let i = itemStartIdx; i < allLines.length; i++) {
    const line = allLines[i];

    // Stop at footer / financial summary block
    if (FOOTER_RE.test(line)) break;

    // VOID block heading — skip subsequent lines until next item number
    if (VOID_HEADING_RE.test(line)) {
      inVoidBlock = true;
      continue;
    }

    // Void adjustment line: "0000375792 / 2218574  4.00-A"
    if (VOID_ADJ_RE.test(line)) continue;

    if (inVoidBlock) {
      // Resume once we see a fresh item number (3+ digits)
      if (ITEM_NUM_RE.test(line)) inVoidBlock = false;
      else continue;
    }

    itemLines.push(line);
  }

  // ── 4. Parse items ────────────────────────────────────────────────────────
  const items: ParsedItem[] = [];

  for (let i = 0; i < itemLines.length; i++) {
    const line = itemLines[i];
    const numMatch = ITEM_NUM_RE.exec(line);
    if (!numMatch) continue;

    const number = numMatch[1];

    // Everything after the item number is name (+ possibly price)
    const rest = line.slice(numMatch[0].length).trim();
    const tokens = rest.split(/\s+/).filter(Boolean);

    let { name, price } = extractNameAndPrice(tokens);

    // If no price on this line, check the very next line
    if (price === null && i + 1 < itemLines.length) {
      const nextLine = itemLines[i + 1].trim();

      // Case A: next line is ONLY a price (e.g. "9.00" or "26.99 A")
      const priceOnlyMatch = PRICE_ONLY_LINE_RE.exec(nextLine);
      if (priceOnlyMatch) {
        price = parseMoney(priceOnlyMatch[1]);
        i++; // consume that line
      }
      // Case B: next line is a name continuation (no item number, no price)
      else if (
        !ITEM_NUM_RE.test(nextLine) &&
        !VOID_ADJ_RE.test(nextLine) &&
        !QTY_LINE_RE.test(nextLine) &&
        !FOOTER_RE.test(nextLine)
      ) {
        const nextTokens = nextLine.split(/\s+/).filter(Boolean);
        const ext = extractNameAndPrice(nextTokens);
        if (ext.price !== null) {
          name = name ? name + " " + ext.name : ext.name;
          price = ext.price;
          i++;
        }
        // else: continuation with no price — just append to name, price stays null
        else if (ext.name) {
          name = name ? name + " " + ext.name : ext.name;
          i++;
        }
      }
    }

    // Skip if we still have no valid price
    if (price === null || price <= 0) continue;

    // Quantity line? e.g. "10 @ 1.50"
    let quantity = 1;
    if (i + 1 < itemLines.length) {
      const qtyMatch = QTY_LINE_RE.exec(itemLines[i + 1].trim());
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
        i++;
      }
    }

    items.push({
      number,
      name: name || "(unknown)",
      price,
      quantity,
    });
  }

  // ── 5. Financial summary ──────────────────────────────────────────────────
  // Subtotal is computed from parsed items — not read from the receipt
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // TAX — "TAX  8.51" (single tax line, not "TOTAL TAX")
  // Falls back to 0 if not found on the receipt
  const taxMatch = cleanText.match(/^TAX\s+([\d,.]+)/im);
  const tax: number = taxMatch ? parseMoney(taxMatch[1]) : 0;

  // TOTAL — Costco prints "**** TOTAL" or "*** TOTAL"
  // Also accepts "AMOUNT: $452.12" as fallback.
  // Final fallback: derive from parsed subtotal + tax so it is never undefined.
  const totalMatch =
    cleanText.match(/\*+\s*TOTAL[^0-9]*([\d,.]+)/i) ??
    cleanText.match(/AMOUNT:\s*\$?([\d,.]+)/i);
  const total: number = totalMatch
    ? parseMoney(totalMatch[1])
    : parseFloat((subtotal + tax).toFixed(2));

  // ── 6. Date ───────────────────────────────────────────────────────────────
  const dateRegex = /\b(\d{2}\/\d{2}\/(?:\d{2}|\d{4})\s+\d{2}:\d{2})\b/g;
  const dateMatches = [...cleanText.matchAll(dateRegex)];
  const date = dateMatches.length
    ? dateMatches[dateMatches.length - 1][1]
    : undefined;

  // ── 7. Total items sold — computed from parsed items ─────────────────────
  const totalItemsSold = items.reduce((sum, item) => sum + item.quantity, 0);

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