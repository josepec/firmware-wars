FIRMWARE WARS - favicon package (logo 4a)
=========================================

Sube estos archivos a la RAIZ de tu web:
  favicon.ico
  favicon.svg
  favicon-96x96.png
  apple-touch-icon.png
  web-app-manifest-192x192.png
  web-app-manifest-512x512.png
  site.webmanifest

Pega esto dentro de <head>:

<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-title" content="Firmware Wars" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#0a0d0a" />

Notas
-----
- favicon.ico contiene 16, 32 y 48 px con una version simplificada del
  logo (hexagono + nucleo solido + 3 nodos) para que se lea a tamano
  diminuto. Los tamanos grandes usan el 4a completo.
- favicon-16/32/48.png van sueltos por si los necesitas.
- Los archivos "_src-*.svg" son las fuentes de generacion; no hay que subirlos.
- TODOS los archivos tienen fondo transparente: solo el hexagono verde.
  En iOS el apple-touch-icon se vera sobre fondo blanco/negro segun el
  sistema; si prefieres plaquita oscura, dimelo y la genero aparte.
- Verde #8fd98a
