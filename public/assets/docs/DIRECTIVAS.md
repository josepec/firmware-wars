# Directivas de layout para Markdown

Directivas especiales que se escriben en una línea propia dentro de los `.md`.
El parser las convierte en HTML con clases CSS que controlan el layout en la web y en el PDF.

---

## Columnas

```
/two-col          ← abre contenedor de 2 columnas
/three-col        ← abre contenedor de 3 columnas
/col              ← fuerza salto a la siguiente columna
/end-col          ← cierra el contenedor de columnas
```

Ejemplo:

```markdown
/two-col
Contenido de la columna izquierda...

/col
Contenido de la columna derecha...

/end-col
```

Aliases: `/two-columns`, `/three-columns`, `/column`, `/end-columns`

---

## Salto de página

```
/page             ← inserta un salto de página (solo afecta al PDF)
```

En la web no tiene efecto visual. En el PDF fuerza que el contenido siguiente
empiece en una nueva página.

---

## Bloque indivisible (keep)

```
/keep             ← abre un bloque que NO se partirá entre páginas
/end-keep         ← cierra el bloque
```

Ejemplo:

```markdown
/keep
| Col A | Col B |
|-------|-------|
| dato  | dato  |
| dato  | dato  |
/end-keep
```

Útil para tablas pequeñas, bloques de código, o cualquier contenido
que deba mantenerse junto en la misma página del PDF.

---

## Espacio vertical

```
/space            ← inserta un espacio vertical (1rem web, 0.4cm PDF)
```

---

## Tablas JSON

```
/json ruta/archivo.json
```

Carga una tabla desde un archivo JSON en `assets/data/`.
El JSON debe tener la estructura `{ columns: [...], rows: [...] }`.

---

## Imágenes

```
/img archivo.png            ← ancho completo (100% del contenedor)
/img-center archivo.png     ← centrada a su tamaño natural
/img-small archivo.png      ← centrada, máximo 50% del ancho
```

Las imágenes se buscan en `assets/docs/img/`. También acepta URLs absolutas.

Dentro de columnas, las tres variantes se adaptan al ancho de la columna automáticamente.

Ejemplo:

```markdown
/img tablero-completo.png

/two-col
/img-center componente-a.png

/col
/img-center componente-b.png

/end-col

/img-small logo-fw.png
```

| Variante      | Comportamiento                                          |
|---------------|---------------------------------------------------------|
| `/img`        | Estira al 100% del ancho (diagramas, mapas, tableros)  |
| `/img-center` | Tamaño natural, centrado (fotos, capturas)              |
| `/img-small`  | Max 50% del ancho, centrado (iconos, logos, QR)         |

---

## Resumen rápido

| Directiva      | Efecto                                      |
|----------------|---------------------------------------------|
| `/two-col`     | Abre layout de 2 columnas                   |
| `/three-col`   | Abre layout de 3 columnas                   |
| `/col`         | Salto a siguiente columna                   |
| `/end-col`     | Cierra contenedor de columnas               |
| `/page`        | Salto de página (PDF)                       |
| `/keep`        | Abre bloque indivisible                     |
| `/end-keep`    | Cierra bloque indivisible                   |
| `/space`       | Espacio vertical                            |
| `/img <ruta>`        | Imagen a ancho completo                |
| `/img-center <ruta>` | Imagen centrada, tamaño natural        |
| `/img-small <ruta>`  | Imagen centrada, max 50%               |
| `/json <ruta>` | Tabla desde JSON                            |
