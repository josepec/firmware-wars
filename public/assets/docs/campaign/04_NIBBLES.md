# MARKET.SYS: Economía

## El ecosistema económico de campaña

Los **Nibbles ◈** ganados en combate se gestionan entre escenarios a través del **MARKET.SYS** — la fase de mercado donde los Programadores reparan Bots, amplían su arsenal y toman decisiones económicas que afectan a su rendimiento en los siguientes escenarios.

---

## Ingresos por escenario

### Resultado de combate

/json tables/campaign/nibbles-income.json

---

## Reparaciones por Acto

El coste de reparar un Bot destruido varía según el Acto en que se produzca la baja:

/json tables/campaign/nibbles-repair.json

---

### Estado Crítico

Si un Programador no puede pagar la reparación de un Bot, puede declararlo en `Estado Crítico`:

- El Bot participa en el siguiente escenario con `MAX_LIFE` **reducido a la mitad**.
- No tiene coste de reparación inmediato.
- Para salir del Estado Crítico, el Programador debe pagar los **25◈** en cualquier MARKET.SYS posterior.

---

## MARKET.SYS — Fase de mercado

El MARKET.SYS ocurre **entre cada escenario**. El jugador que ganó el último escenario tiene **Prioridad de Mercado** y actúa primero. En caso de empate o tras un escenario cooperativo, se resuelve con PPT protocol.

### Acciones disponibles

/json tables/campaign/market-actions.json

### El Baúl

Las funciones compradas en el MARKET.SYS se almacenan en el **Baúl** — un arsenal compartido entre todos los Bots del Programador.

**Reglas del Baúl:**
- No hay límite de funciones almacenadas en el Baúl.
- Antes de cada escenario, el Programador puede **reconfigurar libremente** el loadout de sus Bots usando las funciones disponibles en el Baúl.
- Cada Bot sigue limitado a su configuración base: **2 funciones V1 + 2 funciones V2 + 1 función V3**.
- Las funciones de corpo son exclusivas de la corporación que las compró — ningún otro Programador puede usarlas jamás.

### Stock del mercado

Las funciones generales tienen **stock limitado de 1 copia** por función. Si un jugador compra una función, el otro no puede adquirirla.

Si ambos jugadores quieren la misma función, el que tiene Prioridad de Mercado se la lleva.

---
