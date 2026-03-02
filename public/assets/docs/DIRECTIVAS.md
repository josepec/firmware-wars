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
| `/json <ruta>` | Tabla desde JSON                            |
