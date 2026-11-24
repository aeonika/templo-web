# TemploWeb

Plataforma multitenant para que cada maestro tenga su propio sitio web:
productos físicos y digitales, servicios, cursos y talleres en video y
audio con protección antipiratería, blog, repositorio de documentos
gratis y pagos, promociones, suscripciones y un feed de novedades
público y por curso.

**Estado: modelo funcional v0.1.** El diseño completo está en
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y las decisiones visuales
en [`docs/DISENO.md`](docs/DISENO.md).

## Arquitectura en una línea

Frontend 100% estático (sin build, CDN-first) + Supabase (Auth, Postgres
y RLS) + Cloudinary (medios) + dos funciones serverless en Vercel que
firman subidas y entregas para que el contenido pago nunca tenga una
URL permanente.

## Páginas

| Ruta | Qué es |
|---|---|
| `index.html` | Landing de la plataforma, con el feed global de los maestros. |
| `sitio.html?s=<slug>` (o `/s/<slug>`) | El sitio público de un maestro: navegación, quién soy, destacados, productos, cursos, artículos, documentos, promociones y feed. |
| `curso.html?s=<slug>&c=<curso>` | El aula: índice de lecciones, suscripción y reproductor seguro. |
| `panel.html` | Registro, login, editores de todos los módulos, alumnos y «mi aprendizaje». |

## Puesta en marcha

1. **Supabase**: creá un proyecto y ejecutá `supabase/esquema.sql` en el
   SQL Editor. Copiá la URL del proyecto y la clave anónima.
2. **Cloudinary**: creá una cuenta y anotá cloud name, API key y secret.
3. **Config del frontend**: copiá `config.ejemplo.js` como `config.js` y
   completá URL, clave anónima y cloud name. (La clave anónima es
   pública por diseño: la seguridad la ponen las políticas RLS.)
4. **Vercel**: importá este repo y cargá las variables de entorno
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `CLOUDINARY_CLOUD`,
   `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. Sin comando de build;
   el directorio de salida es la raíz.
5. Abrí el sitio, registrate en el panel y creá el primer sitio.

## Cómo se protege el contenido pago

- Las lecciones y documentos pagos se suben a Cloudinary como
  `authenticated` (privados). La base solo guarda el ID, nunca una URL.
- Para verlos, el aula pide una URL a `api/firmar.js`, que verifica la
  sesión y la suscripción activa en Supabase y devuelve una dirección
  firmada que **vence en 15 minutos**.
- RLS impide además que un no-suscripto lea siquiera las filas de las
  lecciones pagas; el índice público solo expone título, tipo y orden.
- Detalle y límites honestos de la protección: `docs/ARQUITECTURA.md` §7.

## Estructura

```
index.html · sitio.html · curso.html · panel.html   Páginas
assets/        CSS y JS del frontend (incluye tokens de diseño)
api/           Funciones de Vercel: firmar.js y firmar-subida.js
supabase/      esquema.sql: tablas, vistas, funciones y políticas RLS
docs/          Arquitectura y diseño
config.ejemplo.js   Plantilla de configuración pública
```

## Roadmap

Pasarela integrada con webhooks (activación automática de
suscripciones), subdominios por maestro, emails transaccionales,
analíticas por sitio y PWA. Ver `docs/ARQUITECTURA.md` §10.
