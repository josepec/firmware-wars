# SETUP.PRT: Preparación de la Partida

## 4.1 Tareas Previas

Cada jugador se pone en la piel de un programador **Senior**. Utiliza tu **Alias** y crea un pequeño trasfondo para tu personaje:

- ¿De qué Gran Tecnológica proviene?
- ¿Por qué compite en las 28ª FIRMWARE WARS?
- ¿Qué busca (fama, un contrato, ajustar cuentas de código)?
- ¿Cuánto cobra?
- ¿Cómo creó a sus Bots?

Determinad el número de **Bots** de cada programador. Cada programador seleccionará los suyos en base a los modelos disponibles (ver sección **BOTS.CFG**).

---

## 4.2 Entorno Digitalizado de Combate

Las distancias de movimiento y el alcance de las acciones se miden en **Hexes** (casillas hexagonales) del tablero.

Cada Bot puede desplazarse un número de Hexes igual o menor a su atributo de **Movimiento Máximo** (`MAX_MOVEMENT`), gastando **1 punto de Energía** por cada Hex atravesado. El desplazamiento puede realizarse en cualquiera de las seis direcciones adyacentes al Hex actual.

Para determinar el alcance de un ataque o habilidad, cuenta el número mínimo de Hexes entre el Bot atacante y su objetivo, siguiendo una línea continua de casillas conectadas.

> Tanto al mover como al calcular el alcance, no se pueden atravesar Hexes que representen obstáculos.

### Construcción del tablero

1. Los jugadores se van alternando colocando Hexes para formar el **Entorno Digitalizado de Combate** (campo de batalla). Se irán colocando piezas hasta que tenga un tamaño adecuado para el número de Programadores y Bots. Las piezas pueden ponerse con su cara negra visible para representar un obstáculo y el bloqueo de línea de visión (8-10 piezas es un buen número).

2. Los jugadores despliegan sus Bots en un Hex aleatorio del tablero de batalla, alternándose entre ellos, hasta que no quede ninguno por desplegar.
