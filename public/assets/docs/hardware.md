# HARDWARE.CFG: Componentes

## Materiales del Sistema

Para ejecutar una partida de **Firmware Wars** necesitas los siguientes componentes físicos:

| Componente | Cantidad | Notas |
|---|---|---|
| Miniaturas (Bots) | Variable | Según lista acordada. Mínimo 1 por Programador. |
| Fichas Hex (tablero) | 30–50 piezas | Una de las caras de cada Hex debe ser de color negro sólido. Esta cara representa un obstáculo físico y lógico que obstruye el movimiento y satura la Línea de Visión (LoS), impidiendo la propagación de datos y ataques. La cara activa (no opaca) de los Hexes debe estar vinculada al sistema de Dados de Energía. Los 100 Hexes se dividen en 5 subgrupos de 20 unidades; cada grupo debe estar marcado con un color distintivo (mediante un punto o indicador visual) que corresponda a una de las caras del dado. |
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
| Marcadores de `bugs` | 3 x Bot | Uno por cada bug activo en el Bot. |
| Marcadores de escudo | Variable | Para registrar `shield` activo. |
| Marcadores de estado | Variable | LAG, DMZ, SAFE_MODE, REBOOTING… |
| Fichas de energía | Variable | Para llevar el registro de `energy`. |
| Fichas de vida | Variable | Para llevar el registro de `life`. |
| Terminal de programación | 1 x Bot | Hoja de turno donde anotar el BattleScript (Organizar tus Operaciones, Funciones, Números, etc.) |

---

## El Terminal de Programación

Cada Programador dispone de un **Terminal** por cada Bot: una hoja/tablero de turno donde registra en tiempo real el estado de sus Bots y escribe el **BattleScript** — el código que sus unidades ejecutarán en la fase `RUN()`.

**El Terminal incluye:**

### Modo Hoja
- Variables de estado de cada Bot: `life`, `energy`, `shield`, `bugs`, `version`, `numbers`.
- 3 Ranuras de Operación para la fase `COMPILE()`.
- Área de escritura del BattleScript.
- Registro de efectos activos y estados alterados.

### Modo tablero
En los recursos de la web encontrarás plantillas para poderte imprimir tu propios tableros. El tablero tiene un tamaño A4 con lo siguiente:
- Variables de estado de cada Bot: `life`, `energy`, `shield`, `version`.
- 7 Huecos para dados (d6) donde alojar `numbers`.
- 3 Ranuras de Operación para la fase `COMPILE()`.
- Varias tarjetas de Operaciones (IF, IF-ELSE, FOR, WHILE, TRY-CATCH) para insertar en las Ranuras de Operaciones.
- 3 tarjetas de Bugs para insertar en las Ranuras de Operaciones.
- Varias tarjetas de Funciones para insertar en las Ranuras de las tarjetas de Operaciones.

> La integridad de tu Terminal es responsabilidad tuya y solo tuya. Un registro desfasado no es una excusa; es una sentencia de borrado inmediato.
