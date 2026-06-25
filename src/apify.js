import fs from "fs/promises";
import path from "path";
import { ensureCarruselDirs } from "./storage.js";

const ACTOR_ID = "apify~instagram-scraper"; // apify/instagram-scraper (id shu8hvrXbJbY3Eb9W)

/**
 * Corre el actor de Apify de forma sincrona y devuelve los items del dataset.
 */
async function runActor(url) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Falta APIFY_TOKEN en el .env");

  const endpoint = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}`;

  const input = {
    directUrls: [url],
    resultsType: "details",
    resultsLimit: 1,
    addParentData: false,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify respondio ${res.status}: ${body.slice(0, 300)}`);
  }

  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Apify no devolvio resultados. Revisa que la URL sea un post publico valido.");
  }
  return items[0];
}

/**
 * Extrae la lista ordenada de URLs de imagen de un item del scraper.
 * Carruseles -> childPosts[].displayUrl. Post simple -> images[] o displayUrl.
 */
function extractImageUrls(item) {
  const urls = [];

  if (Array.isArray(item.childPosts) && item.childPosts.length > 0) {
    for (const child of item.childPosts) {
      // Para slides de video usamos displayUrl (el frame/portada).
      if (child.displayUrl) urls.push(child.displayUrl);
    }
  }

  if (urls.length === 0 && Array.isArray(item.images) && item.images.length > 0) {
    urls.push(...item.images);
  }

  if (urls.length === 0 && item.displayUrl) {
    urls.push(item.displayUrl);
  }

  return urls;
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar imagen (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
}

/**
 * Punto de entrada: dado una URL de carrusel, corre Apify, descarga imagenes
 * y devuelve { shortcode, meta, imageFiles }.
 */
export async function scrapeCarrusel(url) {
  const item = await runActor(url);

  const shortcode =
    item.shortCode || item.id || `post_${Date.now().toString(36)}`;

  const imageUrls = extractImageUrls(item);
  if (imageUrls.length === 0) {
    throw new Error("No se encontraron imagenes en el post.");
  }

  const { base, images } = await ensureCarruselDirs(shortcode);

  const imageFiles = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const filename = `${String(i + 1).padStart(2, "0")}.jpg`;
    const destPath = path.join(images, filename);
    try {
      await downloadImage(imageUrls[i], destPath);
      imageFiles.push(filename);
    } catch (err) {
      console.warn(`  ! Slide ${i + 1} no se pudo descargar: ${err.message}`);
    }
  }

  if (imageFiles.length === 0) {
    throw new Error("Ninguna imagen se pudo descargar.");
  }

  const meta = {
    shortcode,
    url: item.url || url,
    tipo: item.type || null,
    autor: item.ownerUsername || null,
    autorNombre: item.ownerFullName || null,
    caption: item.caption || "",
    likes: item.likesCount ?? null,
    comentarios: item.commentsCount ?? null,
    fecha: item.timestamp || null,
    numSlides: imageFiles.length,
    imagenes: imageFiles,
    analizadoEn: new Date().toISOString(),
  };

  return { shortcode, base, imagesDir: images, meta, imageFiles };
}
