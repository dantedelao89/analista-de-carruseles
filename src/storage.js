import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");
export const CARRUSELES_DIR = path.join(DATA_DIR, "carruseles");
export const ESTRUCTURAS_DIR = path.join(DATA_DIR, "estructuras");
export const STRUCTURES_FILE = path.join(ESTRUCTURAS_DIR, "structures.json");

/** Crea la estructura base de carpetas en data/. */
export async function ensureDataDirs() {
  await fs.mkdir(CARRUSELES_DIR, { recursive: true });
  await fs.mkdir(ESTRUCTURAS_DIR, { recursive: true });
}

/** Carpeta de un carrusel concreto (por shortcode). */
export function carruselDir(shortcode) {
  return path.join(CARRUSELES_DIR, shortcode);
}

export async function ensureCarruselDirs(shortcode) {
  const base = carruselDir(shortcode);
  const images = path.join(base, "images");
  await fs.mkdir(images, { recursive: true });
  return { base, images };
}

export async function readJSON(file, fallback = null) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function writeText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, "utf8");
}

export async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Lista los shortcodes de carruseles ya analizados. */
export async function listCarruseles() {
  try {
    const entries = await fs.readdir(CARRUSELES_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
