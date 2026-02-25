# INIT.SYS: Inicialización del Sistema

## ¿Qué es Firmware Wars?

**Firmware Wars** es un juego de combate táctico por turnos para **2 o más jugadores** en el que cada participante asume el rol de un **Programador Senior**: un ingeniero de élite que diseña, despliega y opera unidades robóticas de combate llamadas **Bots**.

El objetivo es claro: superar a los Bots rivales mediante la combinación de estrategia, programación táctica y adaptación a la aleatoriedad del sistema. El campo de batalla es un entorno digitalizado de combate representado con **casillas hexagonales** (Hexes), y las decisiones se toman turno a turno siguiendo un ciclo de fases inspirado en el ciclo de vida del software real.

> La diferencia entre un Programador mediocre y uno de élite no es el hardware — es el código.

---

## ¿Cómo se juega?

Cada turno, el Programador ejecuta el **CORE.CYCLE**: una secuencia de fases que simula el proceso de compilación y ejecución de código en tiempo real.

1. **`BOOT()`** — El Bot arranca: recupera Energía, carga Operaciones aleatorias del sistema y limpia efectos temporales.
2. **`COMPILE()`** — El Programador ordena sus Operaciones y define qué Funciones ejecutará cada una.
3. **`RUN()`** — El código se ejecuta línea por línea. Los condicionales se resuelven con dados, la energía se consume, los ataques impactan.
4. **`DEBUG()`** — Mantenimiento opcional. Permite purgar Bugs, recuperar sistemas y reparar el núcleo.
5. **`END()`** — Se descartan Operaciones, se conserva la memoria y el turno pasa al siguiente.

Los Bots disponibles difieren en estadísticas, ataques especiales y habilidades pasivas. A medida que avanza la partida, los Bots pueden evolucionar mediante `upgrade()` hasta su **versión 3**, desbloqueando operaciones y capacidades más avanzadas.

---

## Objetivo de la Partida

El objetivo predeterminado es la **eliminación total**: destruye todos los Bots del equipo rival. El último Programador con unidades operativas gana la partida.

Los Bots quedan destruidos cuando su variable `life` llega a 0 o menos. Una unidad destruida no puede ser reparada ni reactivada.

---

# AMBIENT.DSK: Entorno del Sistema

## Las 28ª Firmware Wars

El mundo está gobernado por **código**. La infraestructura crítica, los mercados financieros, los sistemas de defensa y hasta las redes de suministro básico funcionan sobre capas de firmware propietario. Quien controla el firmware, controla la realidad.

Las **Firmware Wars** son una competición clandestina — tolerada por las corporaciones porque sirve sus intereses — en la que equipos de programadores compiten desplegando unidades robóticas de combate en entornos digitalizados aislados: arenas de batalla donde el código se convierte en acero, y el acero se convierte en chatarra.

Esta es la **28ª edición**. Cada año las reglas se refinan. Cada año las apuestas suben.

---

## El Programador

Tú no eres el robot. Eres quien lo diseña, quien escribe su firmware de combate, quien toma decisiones bajo presión cuando los recursos escasean y los enemigos avanzan.

Cada Programador tiene un **Alias**, una corporación de procedencia y una razón para estar aquí — un contrato lucrativo, una reputación que forjar, una deuda que saldar o simplemente el pulso de quien vive para el código limpio y el combate sucio.

Los **Bots** son extensiones de tu voluntad. Pero la voluntad sola no gana partidas. La gana el sistema.

---

## El Campo de Batalla

Los combates tienen lugar en **Entornos Digitalizados de Combate**: arenas físicas recubiertas de sensores y transmisores que traducen cada movimiento, cada impacto y cada fallo de código en datos cuantificables.

El tablero se compone de **casillas hexagonales** (Hexes) que los propios jugadores construyen antes de la partida. Algunos Hexes tienen la cara negra: son **obstáculos** que bloquean el movimiento y la línea de visión, creando coberturas tácticas y corredores de combate.

---

# HARDWARE.CFG: Componentes Necesarios

## Materiales del Sistema

Para ejecutar una partida de **Firmware Wars** necesitas los siguientes componentes físicos:

| Componente | Cantidad | Notas |
|---|---|---|
| Miniaturas (Bots) | Variable | Según lista acordada. Mínimo 1 por Programador. |
| Fichas Hex (tablero) | 30–50 piezas | Con cara negra para obstáculos. |
| Dado de 4 caras (d4) | 2 | Para operaciones V1 y V2. |
| Dado de 6 caras (d6) | 4 | Para combate, estados y algunas funciones. |
| Dado de 8 caras (d8) | 1 | Para algunas funciones de ataque. |
| Dado de 10 caras (d10) | 4 | Para condiciones de `RUN()` y `getNumbers()`. |
| Dado de 12 caras (d12) | 1 | Para recuperación de energía en algunos modelos. |
| Marcadores de `bugs` | 10+ | Uno por bug activo por Bot. |
| Marcadores de escudo | 10+ | Para registrar `shield` activo. |
| Marcadores de estado | 10+ | LAG, DMZ, SAFE_MODE, REBOOTING… |
| Fichas de energía | Variable | Para llevar el registro de `energy`. |
| Fichas de vida | Variable | Para llevar el registro de `life`. |
| Terminal de programación | 1 por jugador | Hoja de turno donde anotar el BattleScript. |

---

## El Terminal de Programación

Cada Programador dispone de un **Terminal**: una hoja de turno donde registra en tiempo real el estado de sus Bots y escribe el **BattleScript** — el código que sus unidades ejecutarán en la fase `RUN()`.

El Terminal incluye:

- Variables de estado de cada Bot: `life`, `energy`, `shield`, `bugs`, `version`, `numbers`.
- Ranuras de Operación para la fase `COMPILE()`.
- Área de escritura del BattleScript.
- Registro de efectos activos y estados alterados.

> Mantén tu Terminal actualizado en todo momento. Un error de registro puede costar una partida.

---

## Escala y Medidas

Las distancias se miden en **Hexes**. Cada desplazamiento o alcance se cuenta como el número mínimo de casillas hexagonales contiguas entre dos puntos del tablero, sin atravesar obstáculos.

No se usan reglas ni cintas métricas: el sistema hexagonal garantiza la equidad táctica de las distancias.
