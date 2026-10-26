// The card's receipt (receipts.js): after each card she answers in her folder for Claude, a receipt of her answers, taken from the
// card's result, when the card is in one of brimm-video's fixed forms. The home folder is the one above her folder, which
// settings.js wrote into the hook's args (R25), never HOME. It prints nothing, and a card it cannot read gets no receipt.
import { readFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { receiptFrom, writeReceipt } from "../receipts.js";

try {
  const folder = process.argv[2] || "";
  if (isAbsolute(folder)) {
    const receipt = receiptFrom(JSON.parse(readFileSync(0, "utf8") || "{}"), Date.now());
    if (receipt) writeReceipt(dirname(folder), receipt);
  }
} catch {
  // No receipt: kind then asks for her click again.
}
