import { readJSON, writeJSON, STRUCTURES_FILE } from "./storage.js";
import { callOpenRouter, parseJSONLoose } from "./analyze.js";
import { dedupPrompt } from "./prompts.js";

async function loadStructures() {
  return (await readJSON(STRUCTURES_FILE, [])) || [];
}

async function saveStructures(list) {
  await writeJSON(STRUCTURES_FILE, list);
}

function slug(text) {
  return (text || "estructura")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Pregunta a la IA si la estructura nueva es variacion de una existente.
 * Devuelve { esVariacion, match, razon, nombreSugerido }.
 */
async function clasificar(nueva, existentes) {
  if (existentes.length === 0) {
    return { esVariacion: false, match: null, razon: "Primera estructura registrada.", nombreSugerido: null };
  }
  const prompt = dedupPrompt({
    nueva,
    existentes: existentes.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      tipoEstructura: e.tipoEstructura,
      esqueletoSlides: e.esqueletoSlides,
    })),
  });
  const raw = await callOpenRouter([{ role: "user", content: prompt }], { temperature: 0 });
  return parseJSONLoose(raw);
}

/**
 * Registra el carrusel en la libreria de estructuras.
 * Decide (con IA) si crea una estructura nueva o lo anade como variacion de una existente.
 * Devuelve { estado: "nueva"|"variacion", estructura, razon }.
 */
export async function registrarEstructura({ analysis, meta }) {
  const existentes = await loadStructures();

  const nueva = {
    tipoEstructura: analysis.tipoEstructura || "Sin clasificar",
    esqueletoSlides: analysis.esqueletoSlides || (analysis.slides || []).map((s) => s.rol),
    resumen: analysis.resumen || "",
  };

  const ejemplo = {
    shortcode: meta.shortcode,
    url: meta.url,
    autor: meta.autor,
    thumb: `/data/carruseles/${meta.shortcode}/images/${meta.imagenes?.[0] || "01.jpg"}`,
  };

  let decision;
  try {
    decision = await clasificar(nueva, existentes);
  } catch (err) {
    console.warn(`  ! Dedup fallo, se crea estructura nueva: ${err.message}`);
    decision = { esVariacion: false, match: null, razon: "No se pudo clasificar.", nombreSugerido: null };
  }

  if (decision.esVariacion && decision.match) {
    const idx = existentes.findIndex((e) => e.id === decision.match);
    if (idx !== -1) {
      const yaEsta = existentes[idx].ejemplos.some((e) => e.shortcode === meta.shortcode);
      if (!yaEsta) existentes[idx].ejemplos.push(ejemplo);
      await saveStructures(existentes);
      return { estado: "variacion", estructura: existentes[idx], razon: decision.razon };
    }
  }

  // Estructura nueva.
  const baseId = slug(decision.nombreSugerido || nueva.tipoEstructura);
  let id = baseId;
  let n = 2;
  while (existentes.some((e) => e.id === id)) id = `${baseId}-${n++}`;

  const estructura = {
    id,
    nombre: decision.nombreSugerido || nueva.tipoEstructura,
    descripcion: nueva.resumen,
    tipoEstructura: nueva.tipoEstructura,
    esqueletoSlides: nueva.esqueletoSlides,
    plantillaReplicable: analysis.plantillaReplicable || [],
    ejemplos: [ejemplo],
    createdAt: new Date().toISOString(),
  };
  existentes.push(estructura);
  await saveStructures(existentes);
  return { estado: "nueva", estructura, razon: decision.razon };
}

export async function listEstructuras() {
  return await loadStructures();
}
