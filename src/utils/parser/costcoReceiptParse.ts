interface ParsedItem {
  number: string;
  name: string;
  price: number;
  quantity: number; // default 1
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

const costcoReceiptParser = (rawText: string, ownerId: string): ParsedReceipt => {
  // Clean OCR artifacts
  const cleanText = rawText.replace(/[^\x20-\x7E\n]/g, "").replace(/\r/g, "");
  const lines = cleanText
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const company = lines[0].toLowerCase();

  // 1️⃣ Extract store number (look for # followed by digits)
  const storeMatch = cleanText.match(/#(\d+)/);
  const storeNumber = storeMatch ? storeMatch[1] : undefined;

  // 2️⃣ Extract subtotal, tax, total (flexible regex)
  const subtotalMatch = cleanText.match(/SUBTOTAL[:\s]*\$?([\d,.]+)/i);
  const taxMatch = cleanText.match(/TAX[:\s]*\$?([\d,.]+)/i);
  const totalMatch = cleanText.match(/TOTAL[:\s]*\$?([\d,.]+)/i);

  let subtotal = subtotalMatch ? parseFloat(subtotalMatch[1].replace(/,/g, "")) : undefined;
  let tax = taxMatch ? parseFloat(taxMatch[1].replace(/,/g, "")) : undefined;
  let total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : undefined;

  // fallback: last numeric value as total
  if (total === undefined) {
    const numbers = cleanText.match(/[\d,.]+/g)?.map(n => parseFloat(n.replace(/,/g, "")));
    if (numbers && numbers.length > 0) total = numbers[numbers.length - 1];
  }

  // 3️⃣ Extract items
  const items: ParsedItem[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Match: number + name + price at end of line
    const match = line.replace(/[A-Z]+$/i, "").match(/^(\d+)\s+(.+?)\s+([\d,.]+)$/);
    if (match) {
      const number = match[1];
      let name = match[2].trim();
      const price = parseFloat(match[3].replace(/,/g, ""));
      let quantity = 1;

      // Check if next line is continuation of name (no number at start, no price at end)
      if (i + 1 < lines.length && !lines[i + 1].match(/^\d+/) && !lines[i + 1].match(/[\d,.]+$/)) {
        name += " " + lines[i + 1].trim();
        i++; // skip next line
      }

      items.push({ number, name, price, quantity });
    }
    i++;
  }

  // 4️⃣ Extract date (look for MM/DD/YYYY HH:MM)
  const dateRegex = /(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2})/g;
  const dateMatches = cleanText.match(dateRegex);
  const date = dateMatches ? dateMatches[dateMatches.length - 1] : undefined;

  // 5️⃣ Extract total items sold
  const totalItemsMatch = cleanText.match(/(?:Item|Ites|Items) Sold[:\s]*(\d+)/i);
  const totalItemsSold = totalItemsMatch ? parseInt(totalItemsMatch[1], 10) : undefined;

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
    totalItemsSold
  };
};

export default costcoReceiptParser;