# Terminal de Programación

El Terminal es la hoja de turno de un Bot: donde se registra su estado y se monta el **BattleScript** que ejecutará en la fase `RUN()`. Cada Programador necesita **uno por cada Bot** que lleve a la mesa.

Funciona como un tablero, no como una ficha para escribir. Las Operaciones que salen en la tirada de `BOOT()` se colocan como tarjetas en las Ranuras, dentro de cada tarjeta encajan las Funciones que esa Operación va a ejecutar, y los dados de `numbers` se apoyan en su columna.

Las dos mitades del tablero no se comportan igual al terminar el turno. En `END()` **se retiran las Operaciones ejecutadas**, así que las Ranuras se vuelven a montar desde cero cada turno. Los **`numbers` se quedan** en su columna: solo se gastan al usarlos, y en el siguiente `BOOT()` se tiran tantos dados como huecos hayan quedado libres.

## Qué trae el PDF

- **El tablero** — las 3 Ranuras de Operación de la fase `COMPILE()` y la columna `NUMBERS` con sus 8 huecos, el tope de `MAX_NUMBERS` que puede guardar un Bot.
- **Tarjetas de Operación** — `IF`, `IF-ELSE`, `FOR`, `WHILE` y `TRY-CATCH`, cada una con los huecos donde van sus Funciones. `IF-ELSE` y `TRY-CATCH` llevan dos, y el segundo va marcado como opcional.
- **Tarjetas de `BUG`** — un `BUG` activo ocupa una Ranura y la inutiliza. Como el máximo acumulable son 3, la hoja trae exactamente 3.

Las Funciones que se meten en las tarjetas de Operación son las cartas de [Cartas de Función](/docs/recursos/cards), y los estados alterados se marcan con los hexágonos de [Fichas](/docs/recursos/tokens).

## Impresión

A4 al **100 %, sin «ajustar a página»**, y a una sola cara: aquí no hay dorsos que casar. El tablero es la primera hoja; las demás son tarjetas para recortar.

Las tarjetas se manosean todo el turno, así que agradecen cartulina o una funda. El tablero aguanta bien en papel normal, y plastificado se puede anotar encima con rotulador borrable.

## Descargar

<a href="/assets/pdf/Firmware%20Wars%20-%20Terminal.pdf" target="_blank" rel="noopener">Firmware Wars - Terminal.pdf</a>

> Los 8 huecos de `NUMBERS` son para dados de 6 caras. Si no quieres tener ocho encima de la mesa por Bot, puedes anotar los valores directamente en el hueco.
