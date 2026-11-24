# TemploWeb — Diseño (corrida Hallmark)

Diseño producido con la skill Hallmark v2.0.0 instalada en Muse
(50 temas, puertas anti-slop, revisión con linter). Este archivo es el
registro de decisiones de la corrida.

**Hallmark · v2.0.0**

- **Shape** · Narrative Workflow para la landing · género modern-minimal ·
  job: sign up (la acción es crear el sitio, en el hero y en el cierre)
- **Theme** · Dusk, repartido 2/3 entre Coral, Dusk y Vantage (pizarra
  oscura, vidrio ahumado, una señal periwinkle y una apricot) · diales:
  fog / periwinkle-apricot / glass. La señal periwinkle continúa el
  azul-neón de la marca y la apricot queda reservada a lo premium, como
  pide la identidad de Cristian (dorado solo para énfasis premium/VIP)
- **Chrome** · nav de borde a borde con la marca y una acción · footer de
  un mástil, la marca sobre los enlaces
- **Hero** · Stage: fotografía real de un mar de niebla al atardecer
  (biblioteca de Hallmark, Wikimedia Commons, crédito en el footer), el
  titular sobre la parte clara y el producto en vidrio a la derecha
- **Signature** · el sitio de un maestro renderizado en vidrio ahumado
  sobre el paisaje: la vidriera muestra un curso, un documento y un
  servicio con precios, que es exactamente lo que la plataforma vende
- **Sections** · Hero · Herramientas (libro mayor, no tarjetas) · Tres
  pasos · Novedades (feed global real) · Planes · Cierre · Footer
- **Material** · real: los módulos que Cristian especificó y el flujo de
  suscripciones · pictures: la fotografía de niebla de la biblioteca ·
  absent: testimonios, métricas y logos (no se inventaron)
- **Sweep** · sloplint estático sobre la landing: **0 FAIL** · los REFLEX
  restantes vienen de los tokens del propio scaffold de Dusk · WARN F4
  respondida: el botón premium dorado aparece una sola vez (en Planes)
  como señal de plan pago de la marca, y la segunda acción del hero
  quedó como enlace tipográfico

## Fuera de la corrida

- **El sitio del maestro** (`sitio.html`) no usa el tema Dusk: cada
  tenant elige entre cuatro temas propios por tokens (Crepúsculo,
  Pergamino, Bosque, Obsidiana) y un color de acento. Es la plantilla
  que se vende, no la vidriera de la plataforma.
- **El panel** es una pantalla de trabajo: usa los tokens de Dusk sin la
  fotografía ni el vidrio, con la densidad que pide una herramienta de
  uso diario.
