# 04 — NIBBLES.MD — Economía y MARKET.SYS

## El ecosistema económico de campaña

Los **Nibbles ◈** ganados en combate se gestionan entre escenarios a través del **MARKET.SYS** — la fase de mercado donde los Programadores reparan Bots, amplían su arsenal y toman decisiones económicas que afectan a su rendimiento en los siguientes escenarios.

---

## Ingresos por escenario

### Resultado de combate

| Resultado | Nibbles ganados |
|---|---|
| Victoria con todos los Bots vivos | 40◈ |
| Victoria con alguna baja | 25◈ |
| Derrota sin perder Bots | 15◈ |
| Derrota con bajas | 5◈ |

### Objetivos secundarios

Cada escenario tiene **2 objetivos secundarios opcionales** que otorgan Nibbles adicionales al completarlos.

| Dificultad | Nibbles |
|---|---|
| Objetivo fácil | +5◈ |
| Objetivo difícil | +10◈ |

> Los objetivos secundarios específicos de cada escenario están detallados en la ficha del escenario correspondiente.

---

## Reparaciones por Acto

El coste de reparar un Bot destruido varía según el Acto en que se produzca la baja:

| Acto | Cobertura corporativa | Coste adicional |
|---|---|---|
| **Acto I** | Todas las reparaciones gratuitas | 0◈ |
| **Acto II** | Primera baja por escenario gratuita | 25◈ las siguientes |
| **Acto III** | Primera baja por escenario gratuita | 25◈ las siguientes |

### Narrativa de las reparaciones

**Acto I:** Eres el representante de tu corporación en fase de clasificación. La empresa tiene interés en que llegues en plena forma — cubre todas las reparaciones porque eres su inversión.

**Acto II:** Sigues bajo el paraguas corporativo pero operas con recursos más limitados. La empresa cubre el soporte básico — una unidad por escenario. El resto va a tu cuenta.

**Acto III:** A este nivel del torneo los Programadores operan con mayor autonomía pero también mayor riesgo personal. La corporación ha cumplido su parte.

> *"Enhorabuena, Programador. Has superado la fase de clasificación. A partir de ahora, la Corporación considera que tus activos son tu responsabilidad. El soporte técnico básico cubre una unidad por escenario. El resto... corre de tu cuenta."*

### Estado Crítico

Si un Programador no puede pagar la reparación de un Bot, puede declararlo en **Estado Crítico**:

- El Bot participa en el siguiente escenario con **MAX_LIFE reducido a la mitad**.
- No tiene coste de reparación inmediato.
- Para salir del Estado Crítico, el Programador debe pagar los **25◈** en cualquier MARKET.SYS posterior.

---

## MARKET.SYS — Fase de mercado

El MARKET.SYS ocurre **entre cada escenario**. El jugador que ganó el último escenario tiene **Prioridad de Mercado** y actúa primero. En caso de empate o tras un escenario cooperativo, se resuelve con PPT protocol.

### Acciones disponibles

| Acción | Coste | Restricción |
|---|---|---|
| Comprar función general V1 | 10–20◈ | Stock limitado — 1 copia por función |
| Comprar función general V2 | 15–30◈ | Stock limitado — 1 copia por función |
| Comprar función general V3 | 50◈ | Stock limitado — 1 copia por función |
| Comprar función de corpo V1 | 15–20◈ | Exclusiva — solo tu corporación |
| Comprar función de corpo V2 | 25–35◈ | Exclusiva — solo tu corporación |
| Comprar función de corpo V3 | 50◈ | Exclusiva — solo tu corporación |
| Vender función del baúl | 50% precio original | — |
| Reparar Bot destruido | 25◈ | Ver tabla de reparaciones por Acto |
| Bot en Estado Crítico | 0◈ | MAX_LIFE ÷ 2 el próximo escenario |

### El Baúl

Las funciones compradas en el MARKET.SYS se almacenan en el **Baúl** — un arsenal compartido entre todos los Bots del Programador.

**Reglas del Baúl:**
- No hay límite de funciones almacenadas en el Baúl.
- Antes de cada escenario, el Programador puede **reconfigurar libremente** el loadout de sus Bots usando las funciones disponibles en el Baúl.
- Cada Bot sigue limitado a su configuración base: **2 funciones V1 + 2 funciones V2 + 1 función V3**.
- Las funciones de corpo son exclusivas de la corporación que las compró — ningún otro Programador puede usarlas jamás.

### Stock del mercado

Las funciones generales tienen **stock limitado de 1 copia** por función. Si un jugador compra una función, el otro no puede adquirirla. Esto crea tensión estratégica en el MARKET.SYS — especialmente con las funciones V2 y V3 más valoradas.

Si ambos jugadores quieren la misma función, el que tiene Prioridad de Mercado se la lleva.

---

## Simulación económica de referencia

Para un jugador de rendimiento medio en una campaña completa (6 victorias, 4 derrotas, alguna baja ocasional, 1 objetivo secundario por escenario de media):

| Concepto | Total estimado |
|---|---|
| Resultados de combate | ~250◈ |
| Objetivos secundarios | ~56◈ |
| **Total ganado** | **~306◈** |
| Reparaciones Acto II–III (~3 bajas extra) | ~75◈ |
| Funciones compradas (2V1 + 1V2 + 1V3) | ~120◈ |
| **Total gastado** | **~195◈** |
| **Remanente estimado** | **~110◈** |

> Un jugador con mala racha (muchas derrotas y bajas) puede quedarse con ~50◈ de remanente. Un jugador excelente puede acumular hasta ~200◈. El sistema está calibrado para que siempre haya decisiones económicas reales que tomar.
