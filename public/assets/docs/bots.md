# BOTS.CFG: Bots

## Bots: Unidades de Combate

En las Firmware Wars, un Bot no es simplemente una máquina de guerra; es la manifestación física de tu código, un ejecutable blindado diseñado para operar en las condiciones más hostiles de los Entornos Digitalizados de Combate (EDC). Cada unidad representa una síntesis crítica entre hardware robusto y un firmware altamente adaptable, cuya eficiencia en el campo de batalla depende enteramente de la precisión de la lógica que tú, como Programador Senior, seas capaz de compilar en su núcleo de procesamiento.

La configuración de un Bot es un proceso de ingeniería táctica donde se definen sus variables operativas y protocolos de respuesta.

> Recuerda: Puedes construir tus Bots fácilmente desde el apartado Lista de la web.

## Atributos (Variables)

Las Atributos, o Variables, estarán inicializados a los valores reflejados en la siguiente tabla:

/json tables/initial-bot-variables.json

Cada Bot, tiene **2 Puntos de Mejora** y **1 Punto de Desventaja** que lo especaliza. Cada uno de esos 3 puntos se ha de gastar en una Constante diferente. Los puntos solo pueden aplicarse a las Constantes listadas en la siguiente tabla:

/json tables/points.json

> Algunos Escenarios del modo Campaña pueden dar nuevos Puntos de Mejora y Puntos de Desventaja.

## Funciones Comunes (COMMON.INTERFACE)

Todos los Bots tienen acceso a las siguientes Funciones Comunes que utilizarán en sus Operaciones.

/json tables/common-functions.json

## Funciones de Ataque

A el momento de construir un Bot, se definen como va a ser, que ataques y armas tendrá etc. 

El Programador tiene hasta **120 Nibbles** para gastar en las funciones de su Bot. 
Debe elegir:
- **Dos Funciones** de **Versión 1**.
- **Dos Funciones** de **Versión 2**.
- **Una Función** de **Versión 3**.

/json tables/attack-functions.json

> Los Nibbles, a veces conocidos como Nibs, son la moneda oficial.

## Funciones de Mantenimiento (DEBUG.INTERFACE)

Todos los Bots tienen acceso a las siguientes Funciones de Mantenimiento que pueden utilizar en la fase de `DEBUG()`.

/json tables/debug-functions.json


Una vez.... Se puede hacer con el construtor de lista...