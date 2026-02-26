# INIT.SYS: Introducción

/two-columns
## ¿Qué es Firmware Wars?

**Firmware Wars** es un juego de combate táctico por turnos de **2-3 jugadores** en el que cada participante asume el rol de un **Programador Senior**: un ingeniero de élite que diseña, despliega y opera unidades robóticas de combate llamadas **Bots**.

El objetivo es claro: superar a los Bots rivales mediante la combinación de estrategia, programación táctica y adaptación a la aleatoriedad del sistema. El campo de batalla es un entorno digitalizado de combate formado por unas casillas hexagonales llamadas **Hexes**. Las decisiones se toman turno a turno siguiendo un ciclo de fases inspirado en el ciclo de vida del software **Core Combat System**.

> La diferencia entre un Programador mediocre y uno de élite no es el hardware — es el código.

---

## ¿Cómo se juega?

Cada turno, el Programador ejecuta el **CORE.CYCLE**: una secuencia de fases que simula el proceso de compilación y ejecución de código en tiempo real.

Inicio de ronda:
1. **`INIT()`** — Se determina el orden de activación de los Programadores. El turno rota entre jugadores (un Bot cada uno) hasta completar todos los Bots. Los Upgrades se producen en las rondas 3 y 5.
2. **`BOOT()`** — El Bot arranca, recupera Energía, carga Operaciones aleatorias del sistema y limpia efectos temporales.

Ciclo del Bot Activo:
1. **`COMPILE()`** — El Programador ordena sus Operaciones y define qué Funciones ejecutará cada una.
2. **`RUN()`** — El código se ejecuta línea por línea. Los condicionales se resuelven con dados, la energía se consume, los ataques impactan.
3. **`DEBUG()`** — Mantenimiento opcional: Permite purgar Bugs, recuperar sistemas y reparar el núcleo.
4. **`END()`** — Se descartan Operaciones, se conserva la memoria y la energía. El turno pasa al siguiente Bot o termina la ronda. Si se cumplen las condiciones de victoria, termina la partida.

Los Bots creados difieren en estadísticas y funciones. A medida que avanza la partida, los Bots evolucionan hasta su `version` 3, desbloqueando operaciones, funciones y capacidades más avanzadas.

---
/col
## Objetivo de la Partida

El objetivo predeterminado es la **eliminación total**: destruye todos los Bots del equipo rival. El último Programador con unidades operativas gana la partida. Aunque se puede jugar cualquier escenario de la campaña.

Los Bots quedan destruidos cuando su variable `life` llega a 0 o menos. Una unidad destruida no puede ser reparada ni reactivada.

---
/end-columns

## DEMO: Sintaxis y Directivas

### Código inline coloreado

Usa la operación `IF` para evaluar condiciones, o `FOR` para repetir acciones. Ejecuta funciones como `move()`, `attack()` o `debug()` en cada operación. Las fases del sistema son `INIT()`, `COMPILE()`, `RUN()` y `END()`.

### Bloque BattleScript

```bs
START
  IF (enemy.distance == 1)
    THEN attack(RocketPunch)

  IF-ELSE (energy >= 8)
    THEN move(2)
    ELSE debug()

  FOR (3)
    getNumbers()
END
```

/two-columns

### Operaciones disponibles

- `IF` — Condicional simple. Se resuelve con un dado.
- `IF-ELSE` — Condicional con rama alternativa.
- `FOR` — Repite la función N veces.
- `AND` / `OR` — Combina condiciones.

/col

### Fases del ciclo

| Fase | Descripción |
|------|-------------|
| `INIT()` | Orden de activación |
| `COMPILE()` | Ordena operaciones |
| `RUN()` | Ejecuta el código |
| `END()` | Cierra el turno |

/end-columns