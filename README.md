# 🎠 Analista de Carruseles de Instagram

Herramienta **local** para descomponer carruseles virales de Instagram y poder replicarlos. Pegas la URL de un carrusel y obtienes un *blueprint de réplica* completo, además de una galería de **estructuras ganadoras** que se construye sola y evita duplicados.

No usa base de datos: todo se guarda en carpetas del proyecto y se sirve desde una interfaz web local.

## ¿Qué hace?

1. **Extrae** las imágenes del carrusel con el actor de Apify [`apify/instagram-scraper`](https://apify.com/apify/instagram-scraper).
2. **Analiza** las slides con Gemini (vía OpenRouter) y devuelve un blueprint para replicar: estructura slide por slide, sistema visual, fórmula de copy, formato y CTA.
3. **Traduce** automáticamente al español cualquier carrusel que esté en otro idioma.
4. **Construye una galería de estructuras ganadoras** sin duplicar: si detecta que una estructura ya existe, la marca como *variación* en vez de crear una entrada nueva.

> El análisis se enfoca en **cómo replicar** la anatomía del carrusel, no en explicar por qué se hizo viral.

## Requisitos

- Node.js 18+ (usa `fetch` nativo)
- Una cuenta de [Apify](https://apify.com) con su token
- Una API key de [OpenRouter](https://openrouter.ai)

## Instalación

```bash
git clone https://github.com/dantedelao89/analista-de-carruseles.git
cd analista-de-carruseles
npm install
cp .env.example .env   # luego edita .env con tus llaves reales
```

Edita `.env`:

```
APIFY_TOKEN=apify_api_xxxxxxxx
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx
OPENROUTER_MODEL=google/gemini-2.5-flash
PORT=3000
```

## Uso

```bash
npm start
```

Abre **http://localhost:3000**, pega la URL de un carrusel y dale **Analizar**.

## Estructura del proyecto

```
├─ server.js            # Express: API + interfaz + estáticos
├─ src/
│  ├─ apify.js          # corre el actor y descarga las imágenes
│  ├─ analyze.js        # análisis de visión + traducción (OpenRouter/Gemini)
│  ├─ structures.js     # librería de estructuras + deduplicación con IA
│  ├─ storage.js        # manejo de archivos y carpetas
│  └─ prompts.js        # prompts en español
├─ public/              # interfaz web (HTML/CSS/JS)
└─ data/                # generado en runtime (carruseles + estructuras) — no se versiona
```

## Notas

- `.env` y `data/` están en `.gitignore`: tus llaves y los datos descargados nunca se suben al repo.
- El modelo de Gemini es configurable en `.env` (`OPENROUTER_MODEL`).

## Licencia

MIT
