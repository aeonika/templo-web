# TemploWeb — Diseño y arquitectura

Plataforma multitenant para que cada maestro (docente, practicante, autor)
tenga su propio sitio web completo sin saber programar: productos físicos y
digitales, servicios, blog, promociones, cursos y talleres en video/audio,
repositorio de documentos, suscripciones pagas y un feed de novedades.

Nombre de trabajo: **TemploWeb**. Marca paraguas: Aeonika / El Sigilo Ʒ.
Este documento es el diseño; el repo contiene el **modelo funcional** (v0.1)
listo para conectar a un proyecto Supabase y a una cuenta Cloudinary.

---

## 1. Principios

1. **CDN first.** Todo el frontend es estático (HTML/CSS/JS sin build) y se
   sirve desde el CDN de Vercel. No hay servidor de aplicaciones propio.
2. **Supabase como BaaS.** Auth, Postgres y seguridad por filas (RLS) hacen
   todo el trabajo de backend de datos.
3. **Cloudinary para los medios.** Imágenes públicas por CDN; audio y video
   de pago con entrega autenticada y URLs firmadas de vencimiento corto.
4. **Un solo frontend, muchos sitios.** La misma plantilla renderiza el sitio
   de cualquier maestro a partir de su `slug`. Agregar un tenant no agrega
   código ni despliegues.
5. **El dinero no pasa por la plataforma (fase 1).** Cada maestro cobra con
   su propio link de pago (Mercado Pago, Stripe, PayPal). La plataforma
   registra el acceso cuando el maestro confirma la suscripción. La
   pasarela integrada con webhooks es la fase 2.

## 2. Arquitectura

```
Visitante ──► CDN (Vercel) ──► index.html        Landing de la plataforma
                          ├──► sitio.html?s=slug  Sitio público del maestro
                          ├──► curso.html?s=&c=   Aula: ver una lección
                          └──► panel.html         Panel (maestro y alumno)
                                    │
                                    ▼
                              Supabase (Auth + Postgres + RLS)
                                    │
Maestro sube medios ──► api/firmar-subida.js (Vercel Function)
                                    │ firma con el API secret
                                    ▼
                              Cloudinary (subida directa del navegador)
                                    │
Alumno pide una lección ──► api/firmar.js (Vercel Function)
                              verifica la suscripción en Supabase con el
                              JWT del alumno y firma una URL de Cloudinary
                              que vence en 15 minutos
```

Las dos funciones serverless son el único código que corre en servidor, y
existen por una sola razón: **el API secret de Cloudinary nunca puede estar
en el navegador**. Todo lo demás es estático + Supabase.

## 3. Multitenancy

- Cada usuario registrado puede crear **un sitio** (tabla `sitios`), con un
  `slug` único: `templo-web.vercel.app/sitio.html?s=mi-templo`.
  Con dominio propio y DNS wildcard en Vercel, el mismo frontend sirve
  `mi-templo.tudominio.com` sin cambios de código (el slug se lee del
  subdominio si existe; si no, del parámetro `s`).
- Todo el contenido cuelga de `sitio_id`. Las políticas RLS garantizan que
  un maestro solo edita lo suyo y que el público solo lee lo publicado.
- Cada sitio elige **paleta** (4 temas con tokens propios: Crepúsculo,
  Pergamino, Bosque, Obsidiana) y **color de acento**. La plantilla aplica
  los tokens por CSS variables; el contenido es el mismo.

## 4. Modelo de datos (Postgres / Supabase)

| Tabla | Para qué |
|---|---|
| `perfiles` | Un registro por usuario de Auth: nombre visible, es su identidad en toda la plataforma. |
| `sitios` | El tenant: dueño, slug, nombre, descripción, logo, foto, quiénes somos, contacto (WhatsApp, email, redes), tema, acento, texto del footer, interruptores de módulos. |
| `productos` | Físicos, digitales o servicios: precio, imagen, `destacado`, link de pago propio, publicado. |
| `articulos` | Blog: título, slug, extracto, cuerpo en Markdown, imagen, publicado. |
| `promociones` | Publicidad del sitio: banners con título, texto, imagen, enlace y orden. |
| `cursos` | Cursos y talleres: descripción, imagen, precio, link de pago, publicado. |
| `lecciones` | El contenido del curso: video, audio, documento o texto. Guarda el `public_id` de Cloudinary y si es `preview` (gratis para todos). |
| `documentos` | Repositorio propio del maestro: documentos gratis (precio 0) o pagos, archivo en Cloudinary. |
| `suscripciones` | Acceso de un alumno a un curso: estado (activa, vencida, cancelada), origen, vencimiento opcional. |
| `accesos_documentos` | Acceso de un alumno a un documento pago. |
| `publicaciones` | El feed: texto e imagen opcionales, con `alcance` = `publico` (sitio + feed global) o `curso` (solo alumnos de ese curso). |

Detalle completo, con índices y políticas RLS, en `supabase/esquema.sql`.

## 5. Los módulos del sitio del maestro

En este orden, cada uno apagable desde el panel:

1. **Barra de navegación**: logo/nombre del sitio, enlaces a las secciones
   activas, botón de contacto y acceso al panel.
2. **Quién soy / quiénes somos**: foto, texto y datos de contacto.
3. **Destacados**: productos marcados `destacado`, en vidriera propia.
4. **Productos y servicios**: grilla con precio y botón de compra (link de
   pago del maestro) o de consulta por WhatsApp si no hay link.
5. **Cursos y talleres**: tarjetas con precio; el botón lleva al aula si el
   visitante ya está suscripto, o al link de pago si no.
6. **Artículos / blog**: lista y lectura completa.
7. **Documentos**: repositorio gratis y pago.
8. **Promociones**: banda de avisos del maestro.
9. **Feed del maestro**: sus publicaciones públicas, en orden cronológico.
10. **Footer**: texto propio, redes y crédito de la plataforma.

## 6. El feed, en dos niveles

- **Feed del sitio**: las publicaciones públicas del maestro aparecen en su
  sitio; las de alcance `curso` aparecen solo dentro del aula, para los
  alumnos de ese curso.
- **Feed global**: la landing de la plataforma muestra las últimas
  publicaciones públicas de todos los maestros. Es el escaparate que le da
  tráfico a cada sitio nuevo.

## 7. Medios y antipiratería (Cloudinary)

Niveles de entrega:

| Contenido | Tipo en Cloudinary | Cómo se entrega |
|---|---|---|
| Imágenes, portadas, previews, lecciones gratis | `upload` (público) | URL de CDN directa. |
| Video/audio/documento **pago** | `authenticated` (privado) | Solo vía `api/firmar.js`: URL firmada que vence en 15 minutos, generada tras verificar la suscripción activa del alumno en Supabase. |

Capas de protección para el contenido pago:

1. **Sin URLs permanentes.** El `public_id` solo no alcanza: sin la firma
   del servidor (que exige sesión + suscripción), Cloudinary responde 401.
2. **Vencimiento corto.** La URL firmada vive 15 minutos; compartirla fuera
   de ese margen no sirve.
3. **Marca de agua con identidad.** Para video pago, la URL firmada puede
   incluir una capa de texto con el email del alumno (transformación de
   Cloudinary): si el material se filtra grabando la pantalla, se sabe de
   qué cuenta salió.
4. **Subida firmada.** El panel nunca sube con credenciales públicas: pide
   la firma a `api/firmar-subida.js`, que valida que el usuario sea dueño
   de un sitio antes de firmar.
5. **RLS en las lecciones.** Ni siquiera la lista de lecciones pagas es
   legible por quien no está suscripto; solo se exponen título y orden de
   las `preview`.

Límite honesto: esto no es DRM de estudio (Widevine/FairPlay es otro nivel
de costo y complejidad). Es la protección correcta para este segmento:
frena el enlace compartido y la descarga casual, e identifica al filtrador.

## 8. Planes de la plataforma

- **Gratis**: 1 sitio, productos y artículos ilimitados en cantidad
  razonable, cursos con lecciones públicas, documentos gratis, feed.
- **Premium**: lecciones y documentos con entrega autenticada (antipiratería),
  suscripciones pagas, feed por curso, temas completos.
  En el modelo, el plan vive en `sitios.plan` y las funciones de firma
  verifican que el sitio sea premium antes de firmar contenido pago.

## 9. Puesta en marcha

1. Crear un proyecto en Supabase y ejecutar `supabase/esquema.sql`.
2. Crear una cuenta Cloudinary; crear dos presets/folders: público y
   autenticado.
3. Copiar `config.ejemplo.js` a `config.js` con la URL y la clave anónima
   de Supabase y el cloud name de Cloudinary.
4. En Vercel, cargar las variables de entorno: `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE` (solo para las funciones),
   `CLOUDINARY_CLOUD`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
5. Subir el repo a GitHub y conectarlo a Vercel. Sin build: salida directa.

## 10. Roadmap

- **Fase 2**: pasarela integrada (Mercado Pago / Stripe) con webhooks que
  activan `suscripciones` solas; subdominios wildcard por tenant; emails
  transaccionales (bienvenida, vencimiento).
- **Fase 3**: analíticas por sitio, certificados de finalización, app
  móvil (PWA instalable), comentarios en lecciones.
