# DATA.LOOT: Botín

## Nodos de Datos y Tesoros

A lo largo de la campaña encontrarás escenarios que contienen un **Nodo de Datos** (otorga **1 XP** al Bot que lo recoge) y  **Tesoros** (otorga **+10◈** al Programador que lo recoge). Su posición en el tablero es pública y conocida desde el inicio del escenario.

Los escenarios que contienen Nodo de Datos están indicados en su ficha correspondiente.

---

## Cómo recoger un Nodo

Para recoger un Nodo de Datos o un Tesoro, el Bot debe:

1. Estar en el **mismo Hex** que el Nodo o Tesoro.
2. Gastar **una Operación completa** ejecutando `extract()`.

```
IF (condición)
  THEN extract()
```

`extract()` no tiene coste energético pero **consume una Operación** del BattleScript.

---

## Reglas de la experiencia por Nodo

- El XP va al **Bot que ejecutó** `extract()`.
- Si el Bot es destruido **antes del final del escenario**, el XP del Nodo se pierde — no se transfiere ni se hereda.
- Máximo **1 Nodo recogible por jugador por escenario**. Si el mismo Programador recoge ambos Nodos de un escenario (si hubiera más de uno), el segundo no otorga XP.

---
