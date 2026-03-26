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
  const lines = rawText
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const company = lines[0].toLowerCase();

  // 1️⃣ Extract store number (look for # followed by digits)
  const storeMatch = rawText.match(/#(\d+)/);
  const storeNumber = storeMatch ? storeMatch[1] : undefined;

  // 2️⃣ Extract subtotal, tax, total
  const subtotalMatch = rawText.match(/SUBTOTAL\s*\$?([\d,.]+)/i);
  const taxMatch = rawText.match(/TAX\s*\$?([\d,.]+)/i);
  const totalMatch = rawText.match(/TOTAL\s*\$?([\d,.]+)/i);

  const subtotal = subtotalMatch ? parseFloat(subtotalMatch[1].replace(/,/g, "")) : undefined;
  const tax = taxMatch ? parseFloat(taxMatch[1].replace(/,/g, "")) : undefined;
  const total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : undefined;

  // 3️⃣ Extract items
  const items: ParsedItem[] = [];
  const itemLineRegex = /^(\d+)\s+(.+?)\s+([\d,.]+)(?:\s+@[\d,.]+)?$/;

  for (const line of lines) {
    const match = line.match(itemLineRegex);
    if (match) {
      const number = match[1];
      const name = match[2].trim();
      const price = parseFloat(match[3].replace(/,/g, ""));
      const quantity = 1;
      items.push({ number, name, price, quantity });
    }
  }

  // 4️⃣ Extract date (last date-looking string)
  const dateRegex = /(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2})/g;
  const dateMatches = rawText.match(dateRegex);
  const date = dateMatches ? dateMatches[dateMatches.length - 1] : undefined;

  // 5️⃣ Extract total items sold
  const totalItemsMatch = rawText.match(/Items Sold[:\s]+(\d+)/i);
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
}

export default costcoReceiptParser