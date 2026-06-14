// ---------------------------------------------------------------------------
// 12 fotorealistische Schatztruhen via OpenAI Bild-API (gpt-image-2 / -1).
// Erzeugt public/chests/chest01..12.png mit transparentem Hintergrund.
//
// Aufruf:   node scripts/generate-chests.mjs
//           node scripts/generate-chests.mjs 3 7      (nur Truhe 3 und 7 neu)
//
// Voraussetzung: OPENAI_API_KEY in .env.local (oder als Umgebungsvariable).
// Kosten: 12 Bilder à 1024×1024 (quality "high"). Bei Bedarf QUALITY ändern.
// ---------------------------------------------------------------------------
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "chests");

// .env.local einlesen (einfacher Parser, damit das Skript ohne next/dotenv läuft)
function loadEnv() {
  if (process.env.OPENAI_API_KEY) return;
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

if (!process.env.OPENAI_API_KEY) {
  console.error("Fehlt: OPENAI_API_KEY (in .env.local oder als Umgebungsvariable).");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL_CHAIN = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"];
const SIZE = "1024x1024";
const QUALITY = "high";          // "high" | "medium" | "low"

// Gemeinsame Stilvorgabe (Fotorealismus, freigestellt). {STATE} wird je nach
// offen/geschlossen ersetzt, damit beide Bilder einer Nummer GLEICH aussehen.
const STYLE = [
  "Photorealistic studio product photograph of a single antique wooden pirate treasure chest.",
  "{STATE}",
  "Sharp focus, fine wood grain and metal detail, soft even studio lighting, gentle realistic shadow under the chest.",
  "Centered composition, the whole chest fully visible with margin around it.",
  "Completely TRANSPARENT background (cut-out / isolated object, no scene, no floor, no wall).",
  "No text, no watermark, no logo, no people, no hands.",
].join(" ");

const STATE_OPEN = "The lid is OPEN and the chest is brimming and OVERFLOWING with thick bundles and loose colorful Euro-style banknotes (blue, orange, green and purple notes) tumbling over the front edge, mixed with a few shiny gold coins. The banknotes look like generic European currency, NOT exact 1:1 reproductions of real legal tender.";
const STATE_CLOSED = "The lid is fully CLOSED and latched; no money is visible, the chest is shut tight.";

// 12 Varianten: Holzton + Beschlag + Blickwinkel (Deckelstellung kommt aus STATE).
const WOODS = ["light oak wood", "dark mahogany wood", "weathered driftwood grey", "rich walnut brown wood"];
const BANDS = ["polished brass bands and lock", "dark wrought-iron bands and lock", "aged copper bands and lock"];
const ANGLES = ["slightly from above, three-quarter front view", "eye-level straight-on front view"];

// Beschreibt das Material EINER Truhe – identisch für offen & geschlossen.
function variantDetails(i) {
  const wood = WOODS[i % WOODS.length];
  const band = BANDS[Math.floor(i / 2) % BANDS.length];
  const angle = ANGLES[Math.floor(i / 3) % ANGLES.length];
  return `Same chest design for both states: ${wood}; ${band}; viewed ${angle}.`;
}

async function generateOne(i, closed) {
  const state = closed ? STATE_CLOSED : STATE_OPEN;
  const prompt = `${STYLE.replace("{STATE}", state)} ${variantDetails(i)}`;
  const name = `chest${String(i + 1).padStart(2, "0")}${closed ? "_closed" : ""}.png`;
  for (const model of MODEL_CHAIN) {
    try {
      const res = await client.images.generate({
        model, prompt, size: SIZE, quality: QUALITY, n: 1,
        background: "transparent", output_format: "png",
      });
      const b64 = res?.data?.[0]?.b64_json;
      if (!b64) throw new Error("Keine Bilddaten erhalten");
      fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(b64, "base64"));
      console.log(`✓ ${name}  (${model})`);
      return;
    } catch (err) {
      const msg = err?.message || String(err);
      if (/model|not found|does not exist|unsupported/i.test(msg)) continue;   // nächstes Modell
      console.error(`✗ ${name}: ${msg}`);
      return;
    }
  }
  console.error(`✗ ${name}: kein Bildmodell verfügbar (${MODEL_CHAIN.join(", ")})`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const flags = process.argv.slice(2);
  const onlyOpen = flags.includes("--open");
  const onlyClosed = flags.includes("--closed");
  const nums = flags.map(Number).filter(n => n >= 1 && n <= 12);
  const indices = nums.length ? nums.map(n => n - 1) : [...Array(12).keys()];
  const states = onlyOpen ? [false] : onlyClosed ? [true] : [false, true];   // Default: beide
  console.log(`Generiere ${indices.length}×${states.length} Bild(er) → ${OUT_DIR}`);
  for (const i of indices) for (const closed of states) await generateOne(i, closed);
  console.log("Fertig. Im Geldregen-Reiter unter „Bilder → Schatztruhe“ (offen/geschlossen) auswählbar.");
}
main();
