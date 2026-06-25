/**
 * Prompts en espanol para el analisis de carruseles y la deduplicacion de estructuras.
 */

/**
 * Prompt de analisis de un carrusel.
 * Enfocado en REPLICAR la anatomia, NO en explicar el "hook" ni "por que se hizo viral".
 * Las imagenes van como mensaje multimodal aparte; aqui solo va la instruccion + el JSON esperado.
 */
export function analysisPrompt({ numImagenes, caption }) {
  return `Eres un analista experto en diseno y copywriting de carruseles de Instagram.
Recibiras las ${numImagenes} imagenes (slides) de un carrusel, EN ORDEN (slide 1 = primera imagen).

Tu trabajo es producir un BLUEPRINT DE REPLICA: la anatomia exacta para que alguien pueda
reconstruir un carrusel con la misma estructura, pero con su propio tema.

REGLAS IMPORTANTES:
- NO expliques "el hook" ni "por que se hizo viral". No analices la viralidad.
- Enfocate solo en COMO esta construido y COMO replicarlo.
- Se concreto y accionable. Describe lo que SE VE en cada slide.
- Responde SIEMPRE en espanol.
- IDIOMA: detecta el idioma del texto del carrusel. En "textoVisible" transcribe el texto TAL CUAL aparece (idioma original). Si el idioma original NO es espanol, en "textoTraducido" pon la traduccion al espanol; si ya esta en espanol, deja "textoTraducido" como cadena vacia "".
- Responde UNICAMENTE con un objeto JSON valido, sin texto adicional, sin markdown, sin \`\`\`.

${caption ? `Caption del post (contexto, no lo analices como viralidad):\n"""${caption.slice(0, 800)}"""\n` : ""}
Estructura EXACTA del JSON que debes devolver:
{
  "tipoEstructura": "nombre corto del patron narrativo (ej: 'Problema -> Pasos -> CTA', 'Lista numerada', 'Mito vs Realidad', 'Antes y Despues', 'Historia personal')",
  "idiomaOriginal": "idioma del carrusel (ej: 'espanol', 'ingles', 'portugues')",
  "resumen": "1-2 frases de como esta armado el carrusel a alto nivel",
  "numSlides": ${numImagenes},
  "slides": [
    {
      "n": 1,
      "rol": "portada | desarrollo | ejemplo | dato | transicion | cierre | cta",
      "mensaje": "que comunica esta slide en una frase",
      "textoVisible": "el texto principal que aparece en la slide, en su idioma original (transcribelo)",
      "textoTraducido": "traduccion al espanol si el original no es espanol; cadena vacia si ya esta en espanol",
      "cantidadTexto": "poco | medio | mucho",
      "layout": "como esta distribuido (titulo arriba, imagen centrada, texto a la izquierda, etc.)",
      "elementosVisuales": "iconos, fotos, ilustraciones, flechas, numeros, fondos, etc."
    }
  ],
  "sistemaVisual": {
    "paletaColores": ["#hex o nombre", "..."],
    "tipografia": "estilo de fuentes (sans serif gruesa, serif elegante, manuscrita, etc.) y jerarquia",
    "estiloImagen": "fotos reales, ilustraciones, 3D, capturas, solo texto, etc.",
    "grid": "como se organiza el espacio (centrado, rejilla, margenes amplios, etc.)",
    "coherencia": "que mantiene la unidad visual entre slides"
  },
  "formulaCopy": {
    "tono": "tono y persona (tu/usted, cercano, autoridad, etc.)",
    "patron": "como esta escrito el texto (frases cortas, preguntas, numeros, listas, etc.)",
    "longitudFrases": "corta | media | larga"
  },
  "formato": {
    "aspecto": "cuadrado 1:1, vertical 4:5, etc.",
    "numSlidesRecomendado": ${numImagenes}
  },
  "cta": {
    "tipo": "seguir | comentar | guardar | compartir | link | ninguno",
    "donde": "en que slide(s) aparece la llamada a la accion",
    "texto": "el texto del CTA si existe"
  },
  "plantillaReplicable": [
    "Paso 1: ... (instruccion accionable para reconstruir el carrusel)",
    "Paso 2: ...",
    "..."
  ],
  "esqueletoSlides": ["rol slide 1", "rol slide 2", "..."]
}`;
}

/**
 * Prompt de deduplicacion: decide si la estructura nueva es una VARIACION de alguna existente.
 */
export function dedupPrompt({ nueva, existentes }) {
  return `Eres un clasificador de estructuras de carruseles de Instagram.
Tu trabajo es decidir si una ESTRUCTURA NUEVA es el MISMO patron que alguna de las ESTRUCTURAS EXISTENTES.

Criterio: dos estructuras son el MISMO patron (es decir, la nueva es una VARIACION de una existente) si
comparten la misma intencion narrativa Y una secuencia de roles de slides equivalente
(pequenas diferencias de numero de slides o de tema NO las hacen distintas).
Si el flujo narrativo y la secuencia de roles son claramente distintos, es una estructura NUEVA.

ESTRUCTURA NUEVA:
- tipoEstructura: ${nueva.tipoEstructura}
- esqueletoSlides: ${JSON.stringify(nueva.esqueletoSlides)}
- resumen: ${nueva.resumen}

ESTRUCTURAS EXISTENTES:
${existentes.length === 0 ? "(ninguna todavia)" : existentes
    .map(
      (e) =>
        `- id: ${e.id}\n  nombre: ${e.nombre}\n  tipoEstructura: ${e.tipoEstructura}\n  esqueletoSlides: ${JSON.stringify(e.esqueletoSlides)}`
    )
    .join("\n")}

Responde UNICAMENTE con un JSON valido, sin markdown:
{
  "esVariacion": true | false,
  "match": "id de la estructura existente que coincide, o null",
  "razon": "explicacion breve en espanol de por que es variacion o por que es nueva",
  "nombreSugerido": "si es NUEVA, un nombre corto y descriptivo para esta estructura; si es variacion, null"
}`;
}
