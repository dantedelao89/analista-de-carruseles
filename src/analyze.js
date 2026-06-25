import fs from "fs/promises";
import path from "path";
import { analysisPrompt } from "./prompts.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getModel() {
  return process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
}

/**
 * Llama a OpenRouter (chat completions). messages = array de mensajes estilo OpenAI.
 * Devuelve el string de contenido de la respuesta.
 */
export async function callOpenRouter(messages, { temperature = 0.3 } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Falta OPENROUTER_API_KEY en el .env");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "Analista de Carruseles",
    },
    body: JSON.stringify({
      model: getModel(),
      temperature,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter respondio ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter no devolvio contenido.");
  return content;
}

/** Extrae el primer objeto JSON de un string (tolera ```json ... ``` o texto extra). */
export function parseJSONLoose(text) {
  let t = text.trim();
  // Quitar fences de markdown si existen.
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(t.slice(start, end + 1));
    }
    throw new Error("No se pudo parsear JSON de la respuesta del modelo.");
  }
}

async function imageToDataUrl(filePath) {
  const buf = await fs.readFile(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase() || "jpeg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Analiza un carrusel: manda las imagenes (base64) + prompt a Gemini y devuelve el JSON del blueprint.
 */
export async function analyzeCarrusel({ imagesDir, imageFiles, caption }) {
  const prompt = analysisPrompt({ numImagenes: imageFiles.length, caption });

  const content = [{ type: "text", text: prompt }];
  for (const file of imageFiles) {
    const dataUrl = await imageToDataUrl(path.join(imagesDir, file));
    content.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  const raw = await callOpenRouter([{ role: "user", content }], { temperature: 0.3 });
  const analysis = parseJSONLoose(raw);

  // Garantiza la traduccion al espanol (paso a prueba de fallos).
  await ensureTranslation(analysis);

  return analysis;
}

/** True si el idioma detectado es espanol. */
function esEspanol(idioma) {
  const i = (idioma || "").toLowerCase();
  return i.includes("espanol") || i.includes("español") || i.includes("spanish") || i.includes("castellano");
}

/**
 * Si el carrusel NO esta en espanol y falta alguna traduccion, hace una llamada
 * dedicada a Gemini para traducir el texto de todas las slides y rellena textoTraducido.
 */
export async function ensureTranslation(analysis) {
  const slides = analysis?.slides || [];
  if (slides.length === 0) return analysis;

  if (esEspanol(analysis.idiomaOriginal)) {
    // En espanol: no hace falta traducir.
    for (const s of slides) s.textoTraducido = "";
    return analysis;
  }

  // Faltan traducciones?
  const faltan = slides.some((s) => (s.textoVisible || "").trim() && !(s.textoTraducido || "").trim());
  if (!faltan) return analysis;

  const textos = slides.map((s) => s.textoVisible || "");
  const prompt = `Traduce al espanol los siguientes textos de las slides de un carrusel (idioma original: ${analysis.idiomaOriginal || "desconocido"}).
Conserva el orden y la cantidad de elementos. Manten saltos de linea, numeros y emojis. Traduccion natural y fiel.
Responde UNICAMENTE con un array JSON de strings (una traduccion por cada texto), sin markdown:
${JSON.stringify(textos, null, 2)}`;

  try {
    const raw = await callOpenRouter([{ role: "user", content: prompt }], { temperature: 0.2 });
    let arr = parseJSONArrayLoose(raw);
    if (Array.isArray(arr)) {
      slides.forEach((s, i) => {
        if (arr[i] != null) s.textoTraducido = String(arr[i]);
      });
    }
  } catch (err) {
    console.warn(`  ! Traduccion fallback fallo: ${err.message}`);
  }
  return analysis;
}

/** Extrae el primer array JSON de un string. */
function parseJSONArrayLoose(text) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("[");
    const end = t.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("No se pudo parsear array JSON.");
  }
}

/** Convierte el analisis JSON en un markdown legible. */
export function analysisToMarkdown(meta, analysis) {
  const a = analysis;
  const lines = [];
  lines.push(`# Analisis de carrusel @${meta.autor || "?"} (${meta.shortcode})`);
  lines.push("");
  lines.push(`- **URL:** ${meta.url}`);
  if (meta.likes != null) lines.push(`- **Likes:** ${meta.likes}`);
  if (meta.comentarios != null) lines.push(`- **Comentarios:** ${meta.comentarios}`);
  if (meta.fecha) lines.push(`- **Fecha:** ${meta.fecha}`);
  lines.push(`- **Slides:** ${meta.numSlides}`);
  lines.push("");
  lines.push(`## Tipo de estructura`);
  lines.push(`**${a.tipoEstructura || "?"}**`);
  if (a.idiomaOriginal) lines.push(`\n*Idioma original: ${a.idiomaOriginal}*`);
  if (a.resumen) lines.push(`\n${a.resumen}`);
  lines.push("");
  lines.push(`## Slide por slide`);
  for (const s of a.slides || []) {
    lines.push(`\n### Slide ${s.n} — ${s.rol || ""}`);
    if (s.mensaje) lines.push(`- **Mensaje:** ${s.mensaje}`);
    if (s.textoVisible) lines.push(`- **Texto visible:** ${s.textoVisible}`);
    if (s.textoTraducido) lines.push(`- **Traduccion (es):** ${s.textoTraducido}`);
    if (s.cantidadTexto) lines.push(`- **Cantidad de texto:** ${s.cantidadTexto}`);
    if (s.layout) lines.push(`- **Layout:** ${s.layout}`);
    if (s.elementosVisuales) lines.push(`- **Elementos visuales:** ${s.elementosVisuales}`);
  }
  if (a.sistemaVisual) {
    const v = a.sistemaVisual;
    lines.push(`\n## Sistema visual`);
    if (v.paletaColores) lines.push(`- **Paleta:** ${(v.paletaColores || []).join(", ")}`);
    if (v.tipografia) lines.push(`- **Tipografia:** ${v.tipografia}`);
    if (v.estiloImagen) lines.push(`- **Estilo de imagen:** ${v.estiloImagen}`);
    if (v.grid) lines.push(`- **Grid:** ${v.grid}`);
    if (v.coherencia) lines.push(`- **Coherencia:** ${v.coherencia}`);
  }
  if (a.formulaCopy) {
    const c = a.formulaCopy;
    lines.push(`\n## Formula de copy`);
    if (c.tono) lines.push(`- **Tono:** ${c.tono}`);
    if (c.patron) lines.push(`- **Patron:** ${c.patron}`);
    if (c.longitudFrases) lines.push(`- **Longitud de frases:** ${c.longitudFrases}`);
  }
  if (a.cta) {
    lines.push(`\n## CTA`);
    lines.push(`- **Tipo:** ${a.cta.tipo || "?"} (${a.cta.donde || "?"})`);
    if (a.cta.texto) lines.push(`- **Texto:** ${a.cta.texto}`);
  }
  if (a.plantillaReplicable) {
    lines.push(`\n## Plantilla replicable`);
    for (const p of a.plantillaReplicable) lines.push(`- ${p}`);
  }
  return lines.join("\n");
}
