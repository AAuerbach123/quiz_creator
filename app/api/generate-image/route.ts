import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_IMAGE_STYLE = `Photorealistic newspaper-cover illustration. ONE single coherent scene with deliberate composition for text overlay.

CRITICAL: SINGLE-SCENE COMPOSITION
- This is ONE photograph of ONE place at ONE moment, NOT multiple images
- All listed topics must appear in the SAME continuous landscape/scene, naturally combined
- NO split-screen, NO diptych, NO collage, NO seam down the middle, NO before/after
- Use natural perspective, depth and overlap to combine subjects: foreground, middle ground, background

PERSONS — ABSOLUTELY FORBIDDEN — UNIVERSAL CLAUSE (always active, regardless of topic):
- NO recognizable likenesses of any real person, living or deceased — no athletes, politicians, entertainers, celebrities, royals, religious leaders, historical figures with documented appearance.
- NO depictions inspired by real persons' iconic features, signature poses, hairstyles, beards, glasses, uniforms or trademark looks — even if no name is given.
- This rule applies to EVERY image, not only when the topic is about persons. Even in geography, sports venues, historical sites, political buildings, or cultural events, real persons must NOT appear recognizably.
- When persons are needed in the scene, use ONLY:
  - anonymous, generic figures in period-appropriate clothing
  - partial views from behind, distant figures at scale where facial features are unresolved
  - faces obscured by perspective, shadow, hats, equipment, or natural occlusion
- Background figures must be ambiguous: no fan signs naming persons, no jersey numbers tied to known players, no portrait paintings of identifiable historical figures on walls.

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

const MODEL_FALLBACK_CHAIN = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1"];

// Map of known IP/brand terms to neutral descriptive alternatives.
// Used when the safety filter blocks a request — we strip brand names
// and re-try with descriptive terms. Order matters: longer phrases first.
const IP_SUBSTITUTIONS: [RegExp, string][] = [
  // Disney / Pixar
  [/\bMickey Mouse\b/gi, "cartoon mouse character"],
  [/\bDonald Duck\b/gi, "cartoon duck character"],
  [/\bWalt Disney\b/gi, "classic animation studio"],
  [/\bDisney\b/gi, "fairytale animation"],
  [/\bPixar\b/gi, "computer-animated film"],
  // Marvel / DC
  [/\bMarvel\b/gi, "comic superhero"],
  [/\bSpider[- ]?Man\b/gi, "spider-themed superhero"],
  [/\bIron Man\b/gi, "armored superhero"],
  [/\bBatman\b/gi, "bat-themed vigilante hero"],
  [/\bSuperman\b/gi, "caped superhero"],
  [/\bWonder Woman\b/gi, "warrior heroine"],
  // Star Wars / Lucasfilm
  [/\bStar Wars\b/gi, "space opera"],
  [/\bDarth Vader\b/gi, "dark armored space villain"],
  [/\bYoda\b/gi, "small wise alien"],
  [/\bJedi\b/gi, "space knight"],
  // Harry Potter
  [/\bHarry Potter\b/gi, "young wizard student"],
  [/\bHogwarts\b/gi, "magical castle school"],
  [/\bDumbledore\b/gi, "elderly wizard headmaster"],
  // Lord of the Rings / Tolkien
  [/\bMiddle[- ]earth\b/gi, "fantasy realm"],
  [/\bGandalf\b/gi, "grey-bearded wizard"],
  [/\bFrodo\b/gi, "hobbit traveller"],
  // Classic public domain that's still flagged
  [/\bPinocchio\b/gi, "wooden puppet boy"],
  [/\bCinderella\b/gi, "young woman in ball gown"],
  [/\bSnow White\b/gi, "fairytale princess with dwarves"],
  [/\bSleeping Beauty\b/gi, "sleeping princess in tower"],
  [/\bPeter Pan\b/gi, "boy who flies"],
  [/\bAlice in Wonderland\b/gi, "girl in magical garden"],
  // Sports leagues
  [/\bNBA\b/gi, "professional basketball league"],
  [/\bNFL\b/gi, "American football league"],
  [/\bFIFA\b/gi, "international football"],
  [/\bUEFA\b/gi, "European football"],
  [/\bOlympics?\b/gi, "international sports games"],
  // Gaming
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

async function tryGenerate(prompt: string): Promise<{ b64: string; model: string } | { error: unknown }> {
  let lastError: unknown = null;
  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      console.log(`[generate-image] Trying model: ${model}`);
      const response = await client.images.generate({
        model,
        prompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      });
      const b64 = response.data?.[0]?.b64_json;
      if (b64) {
        console.log(`[generate-image] ✓ Success with model: ${model}`);
        return { b64, model };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[generate-image] ${model} failed: ${msg}`);
      lastError = e;
      // If this is a safety block, don't try other models with the same prompt —
      // they will all reject it. Bail out and let the caller retry with sanitization.
      if (isSafetyBlock(e)) {
        return { error: e };
      }
    }
  }
  return { error: lastError };
}

export async function POST(req: Request) {
  try {
    const { prompt, styleInstruction, topicElements } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt fehlt" }, { status: 400 });
    }

    const styleBlock = (styleInstruction && typeof styleInstruction === "string" && styleInstruction.trim())
      ? styleInstruction.trim()
      : DEFAULT_IMAGE_STYLE;

    const elementsBlock = Array.isArray(topicElements) && topicElements.length > 1
      ? `\n\nMUST UNIFY THESE ELEMENTS IN A SINGLE COHERENT SCENE: ${topicElements.join(", ")}.\nCombine them naturally using foreground/midground/background depth — not as separate panels.`
      : "";

    const fullPrompt = `${prompt}${elementsBlock}\n\nSTYLE REQUIREMENTS:\n${styleBlock}`;

    // First attempt: original prompt
    let result = await tryGenerate(fullPrompt);

    // If first attempt failed with safety block, sanitize and retry
    let sanitizationNote: string | null = null;
    if ("error" in result && isSafetyBlock(result.error)) {
      console.log(`[generate-image] Safety block detected — attempting prompt sanitization`);
      const { sanitized, changed, replacements } = sanitizePrompt(fullPrompt);
      if (changed) {
        console.log(`[generate-image] Sanitized prompt. Replacements: ${replacements.join("; ")}`);
        sanitizationNote = `Bekannte Markennamen wurden ersetzt durch beschreibende Begriffe: ${replacements.slice(0, 3).join("; ")}`;
        const result2 = await tryGenerate(sanitized);
        if ("b64" in result2) {
          return NextResponse.json({
            image: `data:image/png;base64,${result2.b64}`,
            model: result2.model,
            sanitizationNote
          });
        }
        result = result2;
      } else {
        console.log(`[generate-image] No known IP terms found in prompt — cannot auto-sanitize`);
      }
    }

    // Final failure
    if ("error" in result) {
      const err = result.error;
      const msg = err instanceof Error ? err.message : "Bildgenerierung fehlgeschlagen";
      const isStillSafety = isSafetyBlock(err);
      const friendly = isStillSafety
        ? `Bild wurde von OpenAIs Safety-System blockiert. Tipp: Markennamen oder geschützte Begriffe vermeiden und beschreibende Worte verwenden (z.B. statt "Pinocchio" → "italienische Holzpuppe-Geschichte"). Original-Fehler: ${msg}`
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
    console.error("generate-image error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
