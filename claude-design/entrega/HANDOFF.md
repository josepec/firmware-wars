# HANDOFF — Firmware Wars · Rediseño mobile + ajustes globales

> Instrucciones para aplicar en el repo Angular (firmware-wars). Prototipo de referencia validado por el cliente: "Prototipo Mobile.dc.html" (Omelette).
>
> **REGLA DE ORO: NO cambiar ningún texto/copy existente.** Todos los textos del prototipo (noticias, FAQ, descripciones, hints) son PLACEHOLDERS de maquetación — usar siempre el contenido real que ya existe en el proyecto. Estos cambios son de estilos, estructura y comportamiento, nunca de contenido. Excluir por completo el panel de admin.
>
> Stack: Angular + Tailwind v4 (`@import "tailwindcss"` en `src/styles.css`). Los estilos globales viven en `src/styles.css`; markdown en `src/styles/_markdown.scss`.

---

## 0 · Principios globales (aplican a TODO el sitio salvo admin)

1. **Escala tipográfica mínima.** En mobile ningún texto que el usuario deba leer baja de 12px:
   - `text-[6px]`/`text-[7px]`/`text-[8px]`/`text-[9px]` → `text-xs` (12px) en base; puede bajarse solo con prefijo `sm:`/`md:` si el diseño desktop lo pide.
   - `text-[10px]`/`text-[11px]` → `text-sm` (14px) en textos funcionales (nav, botones, labels de datos); `text-xs` si es puro ornamento.
   - Al subir tamaño, **reducir tracking**: `tracking-[0.3em]`/`tracking-[0.35em]` → máx `tracking-[0.15em]` en mobile (el vibe terminal lo dan la fuente mono y el color, no el tamaño diminuto).
2. **Contraste.** Texto informativo nunca por debajo de `green-400/80` (o un verde-gris dedicado tipo `#8fb8a2`). Las opacidades `/45`–`/65` quedan reservadas a bordes, líneas y ornamentos, no a texto.
3. **Hit targets ≥ 44×44px.** Donde el visual deba seguir pequeño, ampliar el área con padding + margin negativo o un pseudo-elemento `::after` expandido.
4. **`focus-visible` global.** En `styles.css`: `a:focus-visible, button:focus-visible, [tabindex]:focus-visible { outline: 2px solid theme(--color-green-400); outline-offset: 2px; }` (ajustar a sintaxis Tailwind v4 del proyecto).
5. **Estado nunca solo por color.** Donde haya dot verde/amarillo/rojo de estado, acompañar siempre de texto o icono (ya existe COMPILED/INCOMPLETE — mantenerlos junto al dot).

---

## 1 · Navbar → tab bar inferior en mobile (`src/app/shared/components/navbar/`)

**Mobile (< md):**
- Eliminar la segunda fila de navegación (`md:hidden` con los 6 enlaces a 10px).
- Barra superior mínima: logo `:: FIRMWARE WARS ::` (≥ 12px, tracking moderado) + indicador ONLINE (dot con glow + texto ≥ 10px legible). Hacerla `sticky top-0` con fondo `bg-[#040c0f]/95 backdrop-blur`.
- **Nueva tab bar inferior fija** (`fixed bottom-0 inset-x-0`, `md:hidden`, `z-50`), grid de 4 columnas, fondo `rgba(2,8,6,0.96)` + `border-t border-green-500/25` + `backdrop-blur`:
  - **Inicio** (⌂) → `/`
  - **Jugar** (▶) → army builder
  - **Docs** (▤) → docs
  - **Más** (⋯) → página/menú con: Noticias, Soporte, Cómo se juega (ancla al quick-start de la home). Cada entrada: fila de ~56px alto, label 14px + subtítulo 11px opcional + flecha →.
  - Item activo: `text-green-400` (#00ff88); inactivos `text-green-300/55`. Icono ~17px arriba, label 11px debajo. Padding vertical que dé ≥ 48px de alto total. Respetar `env(safe-area-inset-bottom)`.
- Añadir `padding-bottom` (~ 80px) al contenido de página en mobile para que la tab bar no tape el final.

**Desktop (≥ md):** la nav actual se mantiene; solo aplicar principios globales (tamaños/contraste) y comprobar que el dropdown de Docs con `-translate-x-1/2` no se recorte en el borde del viewport (usar lógica de flip o alinearlo a la derecha cerca del borde).

Las páginas **Noticias** y **Soporte** ya existen como rutas: NO crear contenido nuevo; solo asegurar que las tarjetas/listas siguen los principios globales (títulos ≥ 15px, meta ≥ 11px, tarjetas con borde `green-500/20` como el resto del sitio). El acordeón de FAQ (si existe) con área de tap de fila completa ≥ 44px.

---

## 2 · Landing (`src/app/features/landing/landing.html`)

1. **Boot del terminal:**
   - Reproducir solo en primera visita: flag en `localStorage` (p. ej. `fw_boot_seen`). Visitas siguientes → mostrar hero directamente.
   - Skippable: tap/click/tecla en cualquier punto salta la animación.
   - Renderizar el hero desde el primer frame debajo del overlay del boot (el terminal encima, no en lugar del contenido) para no penalizar LCP.
2. **Hero:** tagline y micro-labels según escala global (tagline ≥ 11px mobile, line-height ≥ 1.6). CTAs a ancho completo en mobile con padding vertical ≥ 14px (≈ 48px alto).
3. **Stats (grid-cols-3):** mantener 3 columnas; labels de `text-[8px] tracking-widest` → `text-xs tracking-normal` mínimo en mobile (11–12px), valores sin cambio.
4. **Footer (`footer.html`):** textos 10px → 12px; el enlace/candado de admin con área táctil de 44px (o moverlo fuera del flujo visible).

---

## 3 · Quick-start (`src/app/features/landing/quick-start/`)

Referencia directa: sección "Cómo se juega" del prototipo.

1. **Pipeline de fases** (INIT/BOOT/COMPILE/RUN/DEBUG/END): en mobile, fila con `overflow-x-auto` + `scroll-snap-type: x mandatory`, chips con `flex-shrink-0`, padding ≥ 5px 10px, texto ≥ 9–10px solo si es ornamento duplicado (si es la única etiqueta de fase, ≥ 12px). Al cambiar de paso, **auto-centrar el chip activo** (`scrollIntoView` NO — usar `el.parentElement.scrollTo({left: …, behavior:'smooth'})` calculado).
2. **Dots de paso → barra de progreso.** Sustituir los 8 dots interactivos de 10px por: texto "PASO n/8" (≥ 11px) + barra fina de progreso no interactiva. La navegación queda solo en Anterior/Siguiente.
3. **Controles:** fila propia bajo el contenido; `Anterior` flex-2 outline + `Siguiente` flex-3 sólido verde, ambos con padding vertical ≥ 13px (≈ 48px). Mantener el soporte de teclado y `aria-live` existentes.
4. **Panel de dados del paso** (Comparador / 1d6 / números / resultado): **una sola fila** — contenedor `flex gap-1.5`, cada chip `flex-1 min-w-0 text-center`, label con `truncate`, valor `whitespace-nowrap`. Nunca dos filas.
5. **Terminal:** quitar `min-h-[380px]` en mobile (usar `min-h` menor o auto) para reducir el scroll entre tablero y texto.
6. **Botón cerrar del terminal (w-2.5):** área táctil 44px (padding + margin negativo), visual igual.

---

## 4 · Docs (`src/app/features/docs/`)

1. **Sub-barra sticky de lectura (mobile):** al entrar en una sección, cabecera pegajosa bajo la barra superior con: botón ← (44px) + dos líneas — código de sección (10px, tracking 0.2em, `margin-bottom: 3px`) y "NN · Título" (14px, `tracking [0.06em]`, `line-height 1.3`, truncado con ellipsis). Incluir prev/next de sección si el patrón actual lo permite.
2. **Índice (mobile):** lista de tarjetas de sección a ancho completo, fila ≥ 56px, número + título ≥ 14px. El dropdown actual puede mantenerse como acceso rápido, pero el índice como página es el patrón principal.
3. **`_markdown.scss`:**
   - `.md-col-2`, `.md-col-3` → `column-count: 1` bajo 640px (media query).
   - Tablas (`width: max-content`): envolver en contenedor con `overflow-x-auto` + **affordance de scroll** (sombra/fade en los bordes vía `background-attachment` trick o pseudo-elementos) + primera columna `position: sticky; left: 0` con fondo opaco.
   - Para las tablas clave del reglamento (ciclo de turno, funciones de ataque, equivalencias de dados): en < 640px, presentarlas como **tarjetas apiladas** (una fila = una tarjeta con label+valor por línea), como en el prototipo. Si requiere tocar el renderer markdown, hacerlo vía clase/directiva opcional (`.md-table-cards`) aplicable desde el propio markdown, sin cambiar el contenido.
4. Tipografía markdown en mobile: cuerpo ≥ 15px, `line-height ≥ 1.7`, código inline ≥ 13px.

---

## 5 · Army builder (`src/app/features/army-builder/army-builder.html`)

1. **Tooltips `[data-tooltip]` → información visible/táctil.** En táctil no hay hover:
   - Estado INCOMPLETE: añadir debajo una línea de texto visible que diga qué falta (p. ej. mejoras/desventajas/funciones pendientes — generar desde el estado de validación existente).
   - Descripciones de atributos y costes de nibbles: patrón tap-to-toggle (icono ⓘ de 44px que expande la descripción bajo el elemento) o describir siempre visible en la tarjeta (como el prototipo: nombre + descripción de una línea + coste).
   - El tooltip CSS puede conservarse para desktop (hover), pero nunca ser el único acceso a la info.
2. **Atributos en mobile: 1 columna, filas horizontales.** Cada atributo = fila: nombre+descripción a la izquierda | valor grande | stepper −/+ (usar el patrón `.num-stepper` ya existente en `styles.css`) con botones ≥ 44px. Nada de `grid-cols-2` con botones de 9px en < sm.
3. **Cabecera de estado del bot** (`UNIT_1 // COMPILED — 12/16◈`): permitir wrap controlado — nombre/estado en una línea (truncado), contadores en otra; `whitespace-nowrap` en cada token para que no se partan por dentro. Dot de estado siempre acompañado del texto COMPILED/INCOMPLETE.
4. **Barra de memoria/nibbles:** label y contadores `whitespace-nowrap` con `gap` para que no se pisen con la barra; contadores ≥ 11px.
5. **[DEL], carets y botones pequeños:** área táctil 44px manteniendo el visual.
6. Botones de mejora/desventaja: verificar que la desventaja **resta** el valor mostrado y se refleja en rojo (bug visual detectado en revisión).

---

## 6 · Checklist de verificación (hacer al final, viewport 360×740)

- [ ] Ningún texto legible < 12px en mobile; ningún texto informativo con opacidad < 0.8.
- [ ] Tab bar visible y funcional en todas las rutas públicas; contenido no tapado por ella.
- [ ] Nav superior sticky; sin overflow horizontal en ninguna página a 360px.
- [ ] Quick-start: pipeline con snap centrando fase activa, barra de progreso, botones 48px, dados en una fila.
- [ ] Docs: columnas colapsadas, tablas con scroll affordance o tarjetas, sub-barra sticky sin solaparse.
- [ ] Army builder: sin tooltips-only, atributos en filas con stepper 44px, estado con texto.
- [ ] Boot solo primera visita y skippable.
- [ ] `focus-visible` verde consistente en toda la app.
- [ ] Desktop (≥ md) visualmente igual que antes salvo tamaños/contraste mejorados.
- [ ] **Diff sin cambios de copy**: revisar que ningún texto visible haya cambiado.
