import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const DIR = path.join(process.cwd(), "assets", "fonts");
const files = ["Inter-Regular.ttf", "Inter-Bold.ttf", "Amiri-Regular.ttf", "Amiri-Bold.ttf"];

async function timeOne(file: string) {
  const bytes = fs.readFileSync(path.join(DIR, file));
  const t0 = Date.now();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(bytes);
  const tEmbed = Date.now();
  const page = doc.addPage([595.28, 841.89]);
  page.drawText("Test ABC 123", { x: 50, y: 700, size: 12, font });
  const pdf = await doc.save();
  const tSave = Date.now();
  console.log(
    `${file}: embed=${tEmbed - t0}ms save=${tSave - tEmbed}ms total=${tSave - t0}ms size=${pdf.length}`,
  );
}

async function main() {
  for (const f of files) {
    const t = Date.now();
    await timeOne(f);
    console.log(`  elapsed ${Date.now() - t}ms`);
  }
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
