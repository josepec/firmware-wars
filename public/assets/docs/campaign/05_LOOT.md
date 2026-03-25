# 05 — LOOT.MD — Sistema de Tesoros

## Nodos de Datos

A lo largo de la campaña hay **3 escenarios** que contienen un **Nodo de Datos** — un tesoro que otorga **1 XP** al Bot que lo recoge. Su posición en el tablero es pública y conocida desde el inicio del escenario.

Los escenarios que contienen Nodo de Datos están indicados en su ficha correspondiente.

---

## Tipos de Nodo

### Nodo Fijo
Colocado en un Hex específico al construir el tablero, visible desde el primer turno. La tensión no viene de la sorpresa sino de la disputa por llegar primero.

### Nodo Custodiado *(a partir del Acto II)*
Algunos escenarios incluyen un **Bot Centinela** neutral que custodia el Nodo. El Nodo solo es recogible una vez que el Centinela es eliminado. Cualquier jugador puede eliminarlo — lo que añade la posibilidad de que uno haga el trabajo sucio y el otro llegue a recoger el XP.

**Stats del Centinela:**

| Variable | Valor |
|---|---|
| MAX_LIFE | 6 |
| MAX_ENERGY | 6 |
| MAX_SHIELD | 0 |
| MAX_MOVEMENT | 2 |

El Centinela sigue su propio flowchart de IA simple: si hay un Bot a rango 1, ataca con su función base; si no, permanece inmóvil custodiando el Nodo.

---

## Cómo recoger un Nodo

Para recoger un Nodo de Datos, el Bot debe:

1. Estar en el **mismo Hex** que el Nodo.
2. Gastar **una Operación completa** ejecutando `extractData()`.

```
IF (condición)
  THEN extractData()
```

`extractData()` no tiene coste energético pero **consume una Operación** del BattleScript — ese turno el Bot realiza una acción menos. Es el equilibrio entre explorar y combatir.

---

## Reglas del XP de tesoro

- El XP va al **Bot que ejecutó** `extractData()`.
- Si el Bot es destruido **antes del final del escenario**, el XP del Nodo se pierde — no se transfiere ni se hereda.
- Máximo **1 Nodo recogible por jugador por escenario**. Si el mismo Programador recoge ambos Nodos de un escenario (si hubiera más de uno), el segundo no otorga XP pero sí **15◈** como datos redundantes vendidos.

---

## Distribución de Nodos en la campaña

| Acto | Escenarios con Nodo | Tipo |
|---|---|---|
| Acto I | 1 escenario | Fijo |
| Acto II | 1 escenario | Custodiado |
| Acto III | 1 escenario | Fijo o Custodiado (según escenario) |
| **Total campaña** | **3 Nodos** | — |

> Los escenarios concretos que contienen Nodo de Datos están indicados en sus fichas.
