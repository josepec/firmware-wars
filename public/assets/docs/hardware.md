# HARDWARE.CFG: Componentes

## Materiales del Sistema

Para ejecutar una partida de **Firmware Wars** necesitas los siguientes componentes físicos:

| Componente | Cantidad | Notas |
|---|---|---|
| Miniaturas (Bots) | Variable | Según lista acordada. Mínimo 1 por Programador. |
| Fichas Hex (tablero) | 100 piezas | Una de las caras de cada Hex debe ser de color negro sólido. Esta cara representa un obstáculo físico y lógico que obstruye el movimiento y satura la Línea de Visión (LoS), impidiendo la propagación de datos y ataques. La cara activa (no opaca) de los Hexes debe estar vinculada al sistema del Dado Colores. Es decir, los 100 Hexes se dividen en 5 subgrupos de 20 unidades; cada grupo debe estar marcado con un color distintivo (mediante un punto o indicador visual) que corresponda a una de las caras del Dado Colores. |
| Dado Piedra-Papel-Tijera | 1 | Para determinar iniciativa. |
| Dado Colores | 1 | Dado de 6 caras, con 5 colores diferentes y un símbolo para volver a lanzar (Por si no sale color). |
| Dado Operaciones | 1 | Dado de 6 caras, con los siguientes símbolos (<, ≤, ≥, >, !=, ==) |
| Dado V1 | 1 | Dado de 6 caras, con los siguientes textos (IF, IF-ELSE, IF, IF-ELSE, IF, IF-ELSE) |
| Dado V2 | 1 | Dado de 6 caras, con los siguientes textos (IF, IF-ELSE, IF, IF-ELSE, FOR, WHILE) |
| Dado V3 | 1 | Dado de 6 caras, con los siguientes textos (IF, IF-ELSE, FOR, WHILE, TRY-CATCH, TRY-CATCH) |
| Dado de 4 caras (d4) | 1 | Para algunas funciones de ataque. |
| Dado de 6 caras (d6) | 10-13 x Bot | Para combate, estados y algunas funciones. |
| Dado de 8 caras (d8) | 1 | Para algunas funciones de ataque. |
| Dado de 10 caras (d10) | 1 | Para algunas funciones de ataque. |
| Tarjetas Operaciones y `bugs` | 3 x Operación y Bot | Se insertan en las Ranuras de Operación del Terminal: `IF`, `IF-ELSE`, `FOR`, `WHILE` y `TRY-CATCH`, con sus huecos para las Funciones. Las de `BUG` ocupan una Ranura y la inutilizan; el máximo acumulable son 3.<br>Ver [Terminal de Programación](/docs/recursos/terminal) en los Recursos de la web |
| Cartas de Funciones | 3 x Función y Bot | Las Funciones de ataque elegidas en `BOTS.CFG` más las Comunes. Se colocan en los huecos de las tarjetas de Operación. Tres copias de cada una: las que caben en las 3 Operaciones de un turno.<br>Ver [Cartas de Función](/docs/recursos/cards) en los Recursos de la web |
| Contador de escudo | 1 x Bot | Para registrar `shield` activo. |
| Contador de energía | 1 x Bot | Para llevar el registro de `energy`. |
| Contador de vida | 1 x Bot | Para llevar el registro de `life`. |
| Fichas de estado | 1 x Estado y Bot | `LAG`, `DMZ`, `SAFE_MODE`, `OVERCLOCK`, `BERSERK`, `REBOOTING`… Se colocan junto al Bot mientras dura el estado y se retiran en `BOOT()`.<br>Ver [Fichas](/docs/recursos/tokens) en los Recursos de la web |
| Ficha de Intercepción | 1 x Bot | Ficha de dos caras. Con el lado verde **INTERCEPT** arriba, el Bot tiene su Intercepción disponible; al declararla se gira al lado rojo **USED**, y vuelve al verde al inicio de su siguiente turno.<br>Ver [Fichas](/docs/recursos/tokens) en los Recursos de la web |
| Terminal de programación | 1 x Bot | Hoja de turno donde anotar el BattleScript (organizar tus Operaciones, Funciones, Números, etc.)<br>Ver [Terminal de Programación](/docs/recursos/terminal) en los Recursos de la web |

> Todos los dados de 6 Caras personalizados pueden ser sustituidos fácilmente por Tablas de Equivalencias (ver [Tablas de Dados](/docs/recursos/tables-equivalences) en los Recursos de la web).
---

## El Terminal de Programación

Cada Programador dispone de un **Terminal** por cada Bot: una hoja/tablero de turno donde registra en tiempo real el estado de sus Bots y se escribe el **BattleScript** — el código que sus unidades ejecutarán en la fase `RUN()`.

En los recursos de la web encontrarás plantillas para poder imprimir tu propio terminal. Aunque una parte bonita de este juego, es montar tu propio terminal con los materiales que consideres. 

El tablero imprimible tiene un tamaño A4 con lo siguiente:
- 8 Huecos para dados (d6) donde alojar `numbers`.
- 3 Ranuras de Operación para la fase `COMPILE()`.
- Varias tarjetas de Operaciones (IF, IF-ELSE, FOR, WHILE, TRY-CATCH) para insertar en las Ranuras de Operaciones. En estas tarjetas de Operaciones, se insertan las cartas de Funciones.
- 3 tarjetas de Bugs para insertar en las Ranuras de Operaciones.

> La integridad de tu Terminal es responsabilidad tuya y solo tuya. Un registro desfasado no es una excusa; es una sentencia de borrado inmediato.

---

/img-center /assets/img/programmer.png print-only h:200px