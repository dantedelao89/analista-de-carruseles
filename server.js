import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import {
  ensureDataDirs,
  DATA_DIR,
  carruselDir,
  writeJSON,
  writeText,
  readJSON,
  listCarruseles,
} from "./src/storage.js";
import { scrapeCarrusel } from "./src/apify.js";
import { analyzeCarrusel, analysisToMarkdown } from "./src/analyze.js";
import { registrarEstructura, listEstructuras } from "./src/structures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(DATA_DIR));

await ensureDataDirs();

/** Analiza un carrusel a partir de su URL. */
app.post("/api/analyze", async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/instagram\.com/.test(url)) {
    return res.status(400).json({ error: "Pega una URL valida de Instagram." });
  }

  try {
    console.log(`\n> Analizando: ${url}`);

    console.log("  1/3 Extrayendo imagenes con Apify...");
    const { shortcode, meta, imagesDir, imageFiles } = await scrapeCarrusel(url);
    await writeJSON(path.join(carruselDir(shortcode), "meta.json"), meta);
    console.log(`      ${imageFiles.length} slides descargadas (${shortcode}).`);

    console.log("  2/3 Analizando con Gemini (OpenRouter)...");
    const analysis = await analyzeCarrusel({
      imagesDir,
      imageFiles,
      caption: meta.caption,
    });
    await writeJSON(path.join(carruselDir(shortcode), "analysis.json"), analysis);
    await writeText(
      path.join(carruselDir(shortcode), "analysis.md"),
      analysisToMarkdown(meta, analysis)
    );

    console.log("  3/3 Clasificando estructura...");
    const estructura = await registrarEstructura({ analysis, meta });
    console.log(`      Estructura: ${estructura.estado.toUpperCase()} (${estructura.estructura.nombre}).`);

    res.json({ shortcode, meta, analysis, estructura });
  } catch (err) {
    console.error("  ! Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Lista todos los carruseles analizados. */
app.get("/api/carruseles", async (_req, res) => {
  const codes = await listCarruseles();
  const items = [];
  for (const code of codes) {
    const meta = await readJSON(path.join(carruselDir(code), "meta.json"));
    const analysis = await readJSON(path.join(carruselDir(code), "analysis.json"));
    if (meta) items.push({ meta, analysis });
  }
  items.sort((a, b) => (b.meta.analizadoEn || "").localeCompare(a.meta.analizadoEn || ""));
  res.json(items);
});

/** Devuelve el detalle de un carrusel. */
app.get("/api/carruseles/:shortcode", async (req, res) => {
  const code = req.params.shortcode;
  const meta = await readJSON(path.join(carruselDir(code), "meta.json"));
  const analysis = await readJSON(path.join(carruselDir(code), "analysis.json"));
  if (!meta) return res.status(404).json({ error: "No encontrado." });
  res.json({ meta, analysis });
});

/** Lista la galeria de estructuras ganadoras. */
app.get("/api/estructuras", async (_req, res) => {
  res.json(await listEstructuras());
});

app.listen(PORT, () => {
  console.log(`\nAnalista de Carruseles corriendo en http://localhost:${PORT}`);
});
