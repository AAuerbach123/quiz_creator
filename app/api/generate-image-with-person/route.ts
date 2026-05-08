import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Same as DEFAULT_IMAGE_STYLE in generate-image/route.ts but with the
// PERSONS-FORBIDDEN clause replaced by a "uploaded persons only" clause.
const STYLE_WITH_UPLOADED_PERSONS = `Photorealistic newspaper-cover illustration. ONE single coherent scene with deliberate composition for text overlay.

CRITICAL: SINGLE-SCENE COMPOSITION
- This is ONE photograph of ONE place at ONE moment, NOT multiple images
- All listed topics must appear in the SAME continuous landscape/scene, naturally combined
- NO split-screen, NO diptych, NO collage, NO seam down the middle, NO before/after
- Use natural perspective, depth and overlap to combine subjects: foreground, middle ground, background

PERSONS — UPLOADED-ONLY CLAUSE:
- The persons visible in the input image are the ONLY persons that may appear in the output.
- Preserve their faces, body proportions, clothing and identifying features faithfully — do NOT alter their likeness.
- Do NOT invent additional recognizable persons. No celebrities, athletes, politicians, entertainers, royals, religious leaders, historical figures.
- Background figures, if any, must be ambiguous: distant, faces unresolved, no recognizable likenesses, no fan signs naming persons, no jersey numbers tied to known players, no portrait paintings of identifiable historical figures on walls.
- Place the uploaded persons naturally into the scene as foreground or mid-ground subjects.

LIGHTING — ABSOLUTELY CRITICAL — FULL DIRECT SUNLIGHT:
- BRIGHT MIDDAY SUN — full direct sunlight, clear blue cloudless sky, sun high overhead
- Crisp, clean lighting like a sunny tourist photograph at noon
- Bright vivid colors — blue sky, green foliage, sun-lit stone, white clouds if any
- High exposure, generous brightness throughout the entire frame
- Light tones must dominate the image — bright sky takes upper third, well-lit subjects in lower thirds
- ABSOLUTELY FORBIDDEN: golden hour, sunset, dusk, twilight, blue hour, dawn
- ABSOLUTELY FORBIDDEN: warm orange or amber tones from low sun
- ABSOLUTELY FORBIDDEN: moody, atmospheric, cinematic, dark, shadowy, dim
- ABSOLUTELY FORBIDDEN: heavy shadows on buildings or subjects
- ABSOLUTELY FORBIDDEN: silhouettes, backlighting, lens flares
- ABSOLUTELY FORBIDDEN: teal-and-orange color grading or any cinematic film LUT
- Think: bright sunny postcard, summer holiday photo, clear blue-sky tourism brochure
- NOT: film noir, dramatic landscape photography, golden hour stock photo

LAYOUT FOR TEXT OVERLAY:
- Subject focus in lower or center third
- Upper third: bright clear blue or pale sky — text will sit here
- Subjects fully sun-lit, faces and details clearly visible

COLOR:
- Naturally vibrant, sun-saturated
- Bright blues, fresh greens, warm sunlit beiges and whites
- Mid-to-light tones dominate
- No muddy mid-tones, no desaturated grades

FORBIDDEN:
- No text, logos, watermarks, or signage in the image
- No split-screens, no collages, no diptychs
- No silhouettes that hide subject features
- No dark, moody, cinematic atmosphere`;

const EDIT_MODEL_FALLBACK_CHAIN = ["gpt-image-1.5", "gpt-image-1"];

const IP_SUBSTITUTIONS: [RegExp, string][] = [
  [/\bMickey Mouse\b/gi, "cartoon mouse character"],
  [/\bDonald Duck\b/gi, "cartoon duck character"],
  [/\bWalt Disney\b/gi, "classic animation studio"],
  [/\bDisney\b/gi, "fairytale animation"],
  [/\bPixar\b/gi, "computer-animated film"],
  [/\bMarvel\b/gi, "comic superhero"],
  [/\bSpider[- ]?Man\b/gi, "spider-themed superhero"],
  [/\bIron Man\b/gi, "armored superhero"],
  [/\bBatman\b/gi, "bat-themed vigilante hero"],
  [/\bSuperman\b/gi, "caped superhero"],
  [/\bWonder Woman\b/gi, "warrior heroine"],
  [/\bStar Wars\b/gi, "space opera"],
  [/\bDarth Vader\b/gi, "dark armored space villain"],
  [/\bYoda\b/gi, "small wise alien"],
  [/\bJedi\b/gi, "space knight"],
  [/\bHarry Potter\b/gi, "young wizard student"],
  [/\bHogwarts\b/gi, "magical castle school"],
  [/\bDumbledore\b/gi, "elderly wizard headmaster"],
  [/\bMiddle[- ]earth\b/gi, "fantasy realm"],
  [/\bGandalf\b/gi, "grey-bearded wizard"],
  [/\bFrodo\b/gi, "hobbit traveller"],
  [/\bPinocchio\b/gi, "wooden puppet boy"],
  [/\bCinderella\b/gi, "young woman in ball gown"],
  [/\bSnow White\b/gi, "fairytale princess with dwarves"],
  [/\bSleeping Beauty\b/gi, "sleeping princess in tower"],
  [/\bPeter Pan\b/gi, "boy who flies"],
  [/\bAlice in Wonderland\b/gi, "girl in magical garden"],
  [/\bNBA\b/gi, "professional basketball league"],
  [/\bNFL\b/gi, "American football league"],
  [/\bFIFA\b/gi, "international football"],
  [/\bUEFA\b/gi, "European football"],
  [/\bOlympics?\b/gi, "international sports games"],
  [/\bMario\b/gi, "Italian plumber game character"],
  [/\bPokemon\b/gi, "creature-collecting game characters"],
  [/\bMinecraft\b/gi, "blocky construction video game"],
  [/\bFortnite\b/gi, "battle-royale shooter video game"],
];

function sanitizePrompt(prompt: string): { sanitized: string; changed: boolean; replacements: string[] } {
  let result = prompt;
  const replacements: string[] = [];
  for (const [pattern, replacement] of IP_SUBSTITUTIONS) {
    if (pattern.test(result)) {
      const matches = result.match(pattern);
      if (matches) {
        for (const m of matches) {
          replacements.push(`${m} → ${replacement}`);
        }
      }
      result = result.replace(pattern, replacement);
    }
  }
  return { sanitized: result, changed: result !== prompt, replacements };
}

function isSafetyBlock(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes("safety system") ||
         msg.includes("rejected by") ||
         msg.includes("content policy") ||
         msg.includes("400");
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function tryEdit(
  prompt: string,
  imageBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ b64: string; model: string } | { error: unknown }> {
  let lastError: unknown = null;
  for (const model of EDIT_MODEL_FALLBACK_CHAIN) {
    try {
      console.log(`[generate-image-with-person] Trying model: ${model}`);
      const uploadable = await toFile(imageBuffer, filename, { type: contentType });
      const response = await client.images.edit({
        model,
        image: uploadable,
        prompt,
        size: "1536x1024",
        quality: "medium",
        input_fidelity: "high",
        n: 1,
      });
      const b64 = response.data?.[0]?.b64_json;
      if (b64) {
        console.log(`[generate-image-with-person] ✓ Success with model: ${model}`);
        return { b64, model };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[generate-image-with-person] ${model} failed: ${msg}`);
      lastError = e;
      if (isSafetyBlock(e)) {
        return { error: e };
      }
    }
  }
  return { error: lastError };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const imageEntry = formData.get("image");
    const topic = (formData.get("topic") as string | null)?.trim() || "";
    const promptField = (formData.get("prompt") as string | null)?.trim() || "";
    const styleInstruction = (formData.get("styleInstruction") as string | null)?.trim() || "";
    const topicElementsRaw = formData.get("topicElements") as string | null;

    if (!(imageEntry instanceof File)) {
      return NextResponse.json({ error: "Bild fehlt im Request" }, { status: 400 });
    }
    if (!topic && !promptField) {
      return NextResponse.json({ error: "Topic oder Prompt fehlt" }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(imageEntry.type)) {
      return NextResponse.json({ error: `Bildformat nicht unterstützt: ${imageEntry.type}. Erlaubt: JPG, PNG, WEBP` }, { status: 400 });
    }
    if (imageEntry.size > MAX_BYTES) {
      return NextResponse.json({ error: `Bild zu groß (${(imageEntry.size / 1024 / 1024).toFixed(1)} MB). Maximum 10 MB.` }, { status: 400 });
    }

    let topicElements: string[] = [];
    if (topicElementsRaw) {
      try {
        const parsed = JSON.parse(topicElementsRaw);
        if (Array.isArray(parsed)) topicElements = parsed.filter(x => typeof x === "string");
      } catch {
        // ignore — topicElements is optional
      }
    }

    const styleBlock = styleInstruction || STYLE_WITH_UPLOADED_PERSONS;

    const elementsBlock = topicElements.length > 1
      ? `\n\nMUST UNIFY THESE ELEMENTS IN A SINGLE COHERENT SCENE: ${topicElements.join(", ")}.\nCombine them naturally using foreground/midground/background depth — not as separate panels.`
      : "";

    const basePrompt = promptField || `${topic}, photorealistic, single coherent newspaper cover scene, bright midday sunlight`;

    const fullPrompt = `Integrate the persons from the input image into a new background scene about: ${topic || basePrompt}.\n\n${basePrompt}${elementsBlock}\n\nSTYLE REQUIREMENTS:\n${styleBlock}`;

    const arrayBuffer = await imageEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = imageEntry.name || "upload.jpg";

    let result = await tryEdit(fullPrompt, buffer, filename, imageEntry.type);

    let sanitizationNote: string | null = null;
    if ("error" in result && isSafetyBlock(result.error)) {
      console.log(`[generate-image-with-person] Safety block — attempting prompt sanitization`);
      const { sanitized, changed, replacements } = sanitizePrompt(fullPrompt);
      if (changed) {
        sanitizationNote = `Bekannte Markennamen wurden ersetzt: ${replacements.slice(0, 3).join("; ")}`;
        const result2 = await tryEdit(sanitized, buffer, filename, imageEntry.type);
        if ("b64" in result2) {
          return NextResponse.json({
            image: `data:image/png;base64,${result2.b64}`,
            model: result2.model,
            sanitizationNote
          });
        }
        result = result2;
      }
    }

    if ("error" in result) {
      const err = result.error;
      const msg = err instanceof Error ? err.message : "Bildgenerierung fehlgeschlagen";
      const isStillSafety = isSafetyBlock(err);
      const friendly = isStillSafety
        ? `Bild wurde von OpenAIs Safety-System blockiert. Tipp: Markennamen oder geschützte Begriffe vermeiden. Original-Fehler: ${msg}`
        : msg;
      return NextResponse.json({ error: friendly }, { status: 500 });
    }

    return NextResponse.json({
      image: `data:image/png;base64,${result.b64}`,
      model: result.model,
      sanitizationNote
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("generate-image-with-person error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
