const $ = (sel) => document.querySelector(sel);

const urlInput = $("#url");
const goBtn = $("#go");
const statusEl = $("#status");

function setStatus(html, cls = "") {
  statusEl.className = "status " + cls;
  statusEl.innerHTML = html;
  statusEl.classList.remove("hidden");
}

// --- Tabs ---
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const name = tab.dataset.tab;
    $("#tab-carruseles").classList.toggle("hidden", name !== "carruseles");
    $("#tab-estructuras").classList.toggle("hidden", name !== "estructuras");
    if (name === "estructuras") loadEstructuras();
  });
});

// --- Analizar ---
goBtn.addEventListener("click", analizar);
urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") analizar(); });

async function analizar() {
  const url = urlInput.value.trim();
  if (!url) return;
  goBtn.disabled = true;
  setStatus('<span class="spinner"></span> Extrayendo imágenes, analizando con IA y clasificando estructura… (puede tardar ~30s)');
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");

    const e = data.estructura;
    const msg = e.estado === "nueva"
      ? `✅ Análisis listo. <b>Estructura NUEVA</b> añadida: "${e.estructura.nombre}".`
      : `✅ Análisis listo. Es una <b>variación</b> de "${e.estructura.nombre}". <span class="muted">${e.razon || ""}</span>`;
    setStatus(msg, "ok");
    urlInput.value = "";
    await loadCarruseles();
  } catch (err) {
    setStatus("❌ " + err.message, "error");
  } finally {
    goBtn.disabled = false;
  }
}

// --- Galería de carruseles ---
async function loadCarruseles() {
  const cont = $("#tab-carruseles");
  const items = await (await fetch("/api/carruseles")).json();
  if (!items.length) {
    cont.innerHTML = '<p class="empty">Aún no hay carruseles analizados. Pega una URL arriba para empezar.</p>';
    return;
  }
  cont.innerHTML = '<div class="grid">' + items.map(cardCarrusel).join("") + "</div>";
  cont.querySelectorAll(".card").forEach((c) =>
    c.addEventListener("click", () => abrirCarrusel(c.dataset.code))
  );
}

function cardCarrusel({ meta, analysis }) {
  const thumb = `/data/carruseles/${meta.shortcode}/images/${meta.imagenes?.[0] || "01.jpg"}`;
  const tipo = analysis?.tipoEstructura || "—";
  const likes = meta.likes != null ? `❤️ ${fmt(meta.likes)}` : "";
  return `
    <div class="card" data-code="${meta.shortcode}">
      <img class="thumb" src="${thumb}" loading="lazy" />
      <div class="body">
        <p class="title">@${meta.autor || "?"}</p>
        <p class="meta-line">${meta.numSlides} slides · ${likes}</p>
        <span class="badge">${tipo}</span>
      </div>
    </div>`;
}

// --- Galería de estructuras ---
async function loadEstructuras() {
  const cont = $("#tab-estructuras");
  const list = await (await fetch("/api/estructuras")).json();
  if (!list.length) {
    cont.innerHTML = '<p class="empty">Aún no hay estructuras. Se van creando solas al analizar carruseles.</p>';
    return;
  }
  cont.innerHTML = list.map(structBlock).join("");
  cont.querySelectorAll(".examples img").forEach((img) =>
    img.addEventListener("click", () => abrirCarrusel(img.dataset.code))
  );
}

function structBlock(s) {
  const examples = (s.ejemplos || [])
    .map((e) => `<img src="${e.thumb}" data-code="${e.shortcode}" title="@${e.autor || ""}" />`)
    .join("");
  const skeleton = (s.esqueletoSlides || [])
    .map((r) => `<span class="chip">${r}</span>`)
    .join("");
  return `
    <div class="struct">
      <h3>${s.nombre} <span class="badge count">${(s.ejemplos || []).length} ejemplo(s)</span></h3>
      <div class="type">${s.tipoEstructura}</div>
      <div class="desc">${s.descripcion || ""}</div>
      <div class="skeleton">${skeleton}</div>
      <div class="examples">${examples}</div>
    </div>`;
}

// --- Modal detalle ---
const modal = $("#modal");
$("#modal-close").addEventListener("click", () => modal.classList.add("hidden"));
$(".modal-bg").addEventListener("click", () => modal.classList.add("hidden"));

async function abrirCarrusel(code) {
  const { meta, analysis } = await (await fetch(`/api/carruseles/${code}`)).json();
  const slidesImgs = (meta.imagenes || [])
    .map((f) => `<img src="/data/carruseles/${meta.shortcode}/images/${f}" />`)
    .join("");

  const a = analysis || {};
  const slides = (a.slides || []).map((s) => `
    <div class="slide-block">
      <div class="role">Slide ${s.n} · ${s.rol || ""}</div>
      <div class="kv"><b>Mensaje:</b> ${s.mensaje || "—"}</div>
      ${s.textoVisible ? `<div class="kv"><b>Texto:</b> ${esc(s.textoVisible)}</div>` : ""}
      ${s.textoTraducido ? `<div class="kv"><b>Traducción (es):</b> ${esc(s.textoTraducido)}</div>` : ""}
      <div class="kv muted">${s.layout || ""}${s.elementosVisuales ? " · " + s.elementosVisuales : ""}</div>
    </div>`).join("");

  const plantilla = (a.plantillaReplicable || []).map((p) => `<li>${esc(p)}</li>`).join("");
  const v = a.sistemaVisual || {};
  const c = a.formulaCopy || {};

  $("#modal-content").innerHTML = `
    <h2>@${meta.autor || "?"} — ${a.tipoEstructura || ""}</h2>
    <p class="muted"><a href="${meta.url}" target="_blank" style="color:var(--blue)">${meta.url}</a>
      · ${meta.numSlides} slides ${meta.likes != null ? "· ❤️ " + fmt(meta.likes) : ""} ${meta.comentarios != null ? "· 💬 " + fmt(meta.comentarios) : ""}</p>
    ${a.idiomaOriginal ? `<p class="muted">Idioma original: <b style="color:var(--text)">${esc(a.idiomaOriginal)}</b></p>` : ""}
    <div class="slides-strip">${slidesImgs}</div>
    ${a.resumen ? `<p>${esc(a.resumen)}</p>` : ""}

    <div class="section-title">Slide por slide</div>
    ${slides || '<p class="muted">Sin datos.</p>'}

    <div class="section-title">Sistema visual</div>
    <div class="kv"><b>Paleta:</b> ${(v.paletaColores || []).join(", ") || "—"}</div>
    <div class="kv"><b>Tipografía:</b> ${v.tipografia || "—"}</div>
    <div class="kv"><b>Estilo de imagen:</b> ${v.estiloImagen || "—"}</div>
    <div class="kv"><b>Grid:</b> ${v.grid || "—"}</div>

    <div class="section-title">Fórmula de copy</div>
    <div class="kv"><b>Tono:</b> ${c.tono || "—"}</div>
    <div class="kv"><b>Patrón:</b> ${c.patron || "—"}</div>

    <div class="section-title">CTA</div>
    <div class="kv">${a.cta ? `${a.cta.tipo || "—"} (${a.cta.donde || "—"}) ${a.cta.texto ? "· " + esc(a.cta.texto) : ""}` : "—"}</div>

    <div class="section-title">Plantilla replicable</div>
    <ul class="plantilla">${plantilla || "<li>—</li>"}</ul>
  `;
  modal.classList.remove("hidden");
}

// --- Utils ---
function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : "" + n; }
function esc(s) { return (s || "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m])); }

// Init
loadCarruseles();
