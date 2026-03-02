# SETUP.PRT: Preparación

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

### Escala y Medidas

Las distancias se miden en **Hexes** (casillas hexagonales del tablero). Tanto al mover como al determinar el alcance de un ataque o habilidad, se cuenta el número mínimo de casillas hexagonales contiguas entre dos puntos del tablero, sin atravesar obstáculos o Bots.

No se usan reglas ni cintas métricas: el sistema hexagonal garantiza la equidad táctica de las distancias.

Cada Bot puede desplazarse un número de Hexes igual o menor a su atributo de **Movimiento Máximo** `MAX_MOVEMENT` cada vez que ejecuta un movimiento. Este movimiento tendrá un coste de **1 punto de Energía** por cada Hex atravesado. El desplazamiento puede realizarse en cualquiera de las seis direcciones adyacentes al Hex actual.

Algunos escenarios pueden haber Hexes especiales, cuyo funcionamiento se detallará en el escenario correspondiente.

### Rango de ataques
Excepto si el ataque indica lo contrario, todos los ataques requieren línea de visión del objetivo. La distancia, o rango, será el número mínimo de casillas hexagonales contiguas entre el Bot atacante y el Bot defensor, sin atravesar obstáculos u otros Bots. Esta distancia debe estar dentro del rango del ataque.

Algunos ataques calculan su rango de otras maneras:

- Línea recta: Si el objetivo se encuentra en una **trayectoria alineada** con una de las seis caras del Hex del atacante, el ataque se propaga de forma directa. Si un obstáculo o un Bot ajeno (aliado o enemigo) ocupa un Hex en esa trayectoria, la línea de visión se interrumpe y el ataque no puede realizarse.
- Sin línea de visión: Algunas habilidades o funciones pueden ignorar la Línea de Visión. Aunque ignores la visión, el objetivo debe seguir estando dentro del rango de distancia permitido por la Función.

### Construcción del tablero 

- Escenarios
En los escenarios se seguirán las instrucciones definadas en el propio escenario.

- Eliminación total
Los jugadores se van alternando colocando Hexes para formar el **Entorno Digitalizado de Combate** (campo de batalla). Se irán colocando piezas hasta que estén todas colocadas (100). Las piezas pueden ponerse con su cara negra visible para representar un obstáculo y el bloqueo de línea de visión. Se recomienda no crear agrupaciones de piezas con el mismo color asignado.

### Despliegue

- Escenarios
El escenario puede tener definida una forma de despliegue propia. En tal caso, se seguirán las instrucciones definadas en el propio escenario. Si no, se desplegará igual que en Eliminación total.

- Eliminación total
La secuencia de inicio comienza con el **Programador de menor experiencia** (el mas Junior); no obstante, si este criterio genera conflicto o se prefiere una selección aleatoria, se ejecutará de inmediato el **Protocolo PPT** (Piedra-Papel-Tijera) para designarlo.

Una vez establecido el orden, cada Programador debe realizar un **Lanzamiento de Dado de Colores** para determinar su Hex de entrada. El Bot podrá ser desplegado en **cualquier Hex del tablero que coincida con el color obtenido** en el dado, siempre y cuando se respete el perímetro de seguridad táctica. Este perímetro dicta que ningún Bot puede desplegarn a una **distancia inferior a 6 Hexes** de cualquier Bot enemigo ya desplegado.

En el caso de que la configuración del mapa o las tiradas de dados generen una colisión lógica que haga **imposible cumplir con la distancia mínima de seguridad**, se deberá abortar el proceso, reestructurar el diseño del tablero y reiniciar el despliegue desde el primer paso para garantizar una partida equilibrada.