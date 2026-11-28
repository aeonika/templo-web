-- TemploWeb · Esquema de Supabase (Postgres)
-- Ejecutar completo en el SQL Editor del proyecto Supabase.
-- Seguridad: todo el acceso pasa por RLS. La clave anonima solo puede
-- hacer lo que estas politicas permiten.

create extension if not exists pgcrypto;

-- ============================================================ perfiles
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  es_admin boolean not null default false,
  creado timestamptz not null default now(),
  codigo text unique
);

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
declare cod text; intentos int := 0;
begin
  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '') into cod from generate_series(1,6);
    exit when not exists (select 1 from public.perfiles where codigo = cod);
    intentos := intentos + 1;
    if intentos > 20 then cod := null; exit; end if;
  end loop;
  insert into public.perfiles (id, nombre, codigo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''), cod)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ============================================================ sitios (el tenant)
create table if not exists public.sitios (
  id uuid primary key default gen_random_uuid(),
  dueno_id uuid not null unique references public.perfiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  nombre text not null,
  descripcion text not null default '',
  logo_url text,
  foto_url text,
  fondo_url text,
  rasgos jsonb not null default '[]'::jsonb,
  testimonios jsonb not null default '[]'::jsonb,
  testimonios_titulo text,
  equipo jsonb not null default '[]'::jsonb,
  equipo_titulo text,
  direccion text,
  telefono text,
  horario text,
  mapa_url text,
  quienes_somos text not null default '',
  whatsapp text,
  email text,
  redes jsonb not null default '{}'::jsonb,
  tema text not null default 'crepusculo',
  acento text,
  footer_texto text not null default '',
  plan text not null default 'gratis' check (plan in ('gratis', 'premium')),
  modulos jsonb not null default '{"quienes":true,"destacados":true,"productos":true,"cursos":true,"articulos":true,"documentos":true,"promociones":true,"feed":true}'::jsonb,
  publicado boolean not null default true,
  creado timestamptz not null default now()
);

-- ============================================================ productos y servicios
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  tipo text not null default 'fisico' check (tipo in ('fisico', 'digital', 'servicio')),
  nombre text not null,
  descripcion text not null default '',
  precio numeric(12, 2),
  moneda text not null default 'ARS',
  imagen_url text,
  destacado boolean not null default false,
  link_pago text,
  publicado boolean not null default true,
  orden int not null default 0,
  creado timestamptz not null default now()
);

-- ============================================================ articulos / blog
create table if not exists public.articulos (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  titulo text not null,
  slug text not null,
  extracto text not null default '',
  cuerpo text not null default '',
  imagen_url text,
  publicado boolean not null default true,
  creado timestamptz not null default now(),
  unique (sitio_id, slug)
);

-- ============================================================ promociones
create table if not exists public.promociones (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  titulo text not null,
  descripcion text not null default '',
  imagen_url text,
  link text,
  activa boolean not null default true,
  orden int not null default 0,
  creado timestamptz not null default now()
);

-- ============================================================ cursos y lecciones
create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  titulo text not null,
  descripcion text not null default '',
  imagen_url text,
  precio numeric(12, 2),
  moneda text not null default 'ARS',
  link_pago text,
  publicado boolean not null default true,
  creado timestamptz not null default now()
);

create table if not exists public.lecciones (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  titulo text not null,
  tipo text not null default 'video' check (tipo in ('video', 'audio', 'documento', 'texto')),
  cloudinary_id text,
  url_publica text,
  cuerpo text not null default '',
  es_preview boolean not null default false,
  orden int not null default 0,
  creado timestamptz not null default now()
);

-- Indice publico de lecciones: solo metadatos (sin cloudinary_id).
-- La vista la posee postgres y no hereda el RLS de la tabla: por eso
-- expone unicamente columnas inofensivas.
create or replace view public.lecciones_indice as
  select id, curso_id, sitio_id, titulo, tipo, es_preview, orden
  from public.lecciones;
grant select on public.lecciones_indice to anon, authenticated;

-- ============================================================ documentos (repositorio)
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  titulo text not null,
  descripcion text not null default '',
  cloudinary_id text,
  url_publica text,
  imagen_url text,
  precio numeric(12, 2) not null default 0,
  moneda text not null default 'ARS',
  link_pago text,
  publicado boolean not null default true,
  creado timestamptz not null default now()
);

-- Catalogo publico de documentos: metadatos sin el archivo.
-- La fila completa de `documentos` (con cloudinary_id) queda protegida
-- por RLS; esta vista solo expone lo que un visitante puede ver.
create or replace view public.documentos_indice as
  select id, sitio_id, titulo, descripcion, precio, moneda, link_pago, creado, pagos_modo, metodos_pago, instrucciones_pago, imagen_url
  from public.documentos where publicado;
grant select on public.documentos_indice to anon, authenticated;

-- ============================================================ accesos
create table if not exists public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.perfiles (id) on delete cascade,
  curso_id uuid not null references public.cursos (id) on delete cascade,
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activa', 'vencida', 'cancelada')),
  origen text not null default 'solicitud',
  creada timestamptz not null default now(),
  vence timestamptz,
  unique (alumno_id, curso_id)
);

create table if not exists public.accesos_documentos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.perfiles (id) on delete cascade,
  documento_id uuid not null references public.documentos (id) on delete cascade,
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  estado text not null default 'activa' check (estado in ('activa', 'cancelada')),
  creada timestamptz not null default now(),
  unique (alumno_id, documento_id)
);

-- ============================================================ feed
create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  curso_id uuid references public.cursos (id) on delete cascade,
  alcance text not null default 'publico' check (alcance in ('publico', 'curso')),
  texto text not null,
  imagen_url text,
  creada timestamptz not null default now()
);

-- ============================================================ helpers
create or replace function public.es_dueno(p_sitio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sitios s where s.id = p_sitio and s.dueno_id = auth.uid())
$$;

create or replace function public.tiene_suscripcion(p_curso uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.suscripciones su
    where su.curso_id = p_curso and su.alumno_id = auth.uid()
      and su.estado = 'activa' and (su.vence is null or su.vence > now())
  )
$$;

create or replace function public.tiene_documento(p_doc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.accesos_documentos a
    where a.documento_id = p_doc and a.alumno_id = auth.uid() and a.estado = 'activa'
  )
$$;

-- ============================================================ RLS
alter table public.perfiles enable row level security;
alter table public.sitios enable row level security;
alter table public.productos enable row level security;
alter table public.articulos enable row level security;
alter table public.promociones enable row level security;
alter table public.cursos enable row level security;
alter table public.lecciones enable row level security;
alter table public.documentos enable row level security;
alter table public.suscripciones enable row level security;
alter table public.accesos_documentos enable row level security;
alter table public.publicaciones enable row level security;

-- perfiles: lectura publica del nombre; edicion solo propia
create policy perfiles_lectura on public.perfiles for select using (true);
create policy perfiles_edicion on public.perfiles for update using (id = auth.uid());

-- sitios: publico lee publicados; el dueno, todo lo suyo
create policy sitios_lectura on public.sitios for select
  using (publicado or dueno_id = auth.uid());
create policy sitios_crear on public.sitios for insert with check (dueno_id = auth.uid());
create policy sitios_editar on public.sitios for update using (dueno_id = auth.uid());
create policy sitios_borrar on public.sitios for delete using (dueno_id = auth.uid());

-- contenido del sitio: lectura publica de lo publicado; CRUD del dueno
create policy productos_lectura on public.productos for select
  using (publicado or public.es_dueno(sitio_id));
create policy productos_crud on public.productos for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));

create policy articulos_lectura on public.articulos for select
  using (publicado or public.es_dueno(sitio_id));
create policy articulos_crud on public.articulos for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));

create policy promociones_lectura on public.promociones for select
  using (activa or public.es_dueno(sitio_id));
create policy promociones_crud on public.promociones for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));

create policy cursos_lectura on public.cursos for select
  using (publicado or public.es_dueno(sitio_id));
create policy cursos_crud on public.cursos for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));

-- lecciones: el corazon antipirateria en la base.
-- Sin suscripcion activa solo se leen las preview; el dueno lee todo.
create policy lecciones_lectura on public.lecciones for select
  using (
    public.es_dueno(sitio_id)
    or es_preview
    or public.tiene_suscripcion(curso_id)
  );
create policy lecciones_crud on public.lecciones for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));

-- documentos: la fila completa (con cloudinary_id) solo para el dueno,
-- para quien compro el documento, o si es gratis y publico.
create policy documentos_lectura on public.documentos for select
  using (
    public.es_dueno(sitio_id)
    or public.tiene_documento(id)
    or (publicado and precio = 0)
  );
create policy documentos_crud on public.documentos for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));

-- suscripciones: el alumno ve las suyas; el dueno del sitio las gestiona
create policy suscripciones_lectura on public.suscripciones for select
  using (alumno_id = auth.uid() or public.es_dueno(sitio_id));
create policy suscripciones_gestion on public.suscripciones for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));
-- el alumno solicita acceso: solo puede crear su propia fila en pendiente
create policy suscripciones_solicitar on public.suscripciones for insert
  with check (alumno_id = auth.uid() and estado = 'pendiente');

create policy accesos_lectura on public.accesos_documentos for select
  using (alumno_id = auth.uid() or public.es_dueno(sitio_id));
create policy accesos_gestion on public.accesos_documentos for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));

-- feed: publico para todos; de curso, solo alumnos y dueno
create policy publicaciones_lectura on public.publicaciones for select
  using (
    alcance = 'publico'
    or public.es_dueno(sitio_id)
    or (curso_id is not null and public.tiene_suscripcion(curso_id))
  );
create policy publicaciones_crud on public.publicaciones for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));

-- indices utiles
create index if not exists idx_productos_sitio on public.productos (sitio_id, orden);
create index if not exists idx_articulos_sitio on public.articulos (sitio_id, creado desc);
create index if not exists idx_cursos_sitio on public.cursos (sitio_id);
create index if not exists idx_lecciones_curso on public.lecciones (curso_id, orden);
create index if not exists idx_publicaciones_feed on public.publicaciones (alcance, creada desc);
create index if not exists idx_suscripciones_alumno on public.suscripciones (alumno_id, estado);
-- TemploWeb · Administración de la plataforma (migración, ya incluida en esquema.sql)
-- El dueño de la plataforma es el perfil con es_admin = true: puede ver y
-- gestionar todos los sitios, usuarios y suscripciones desde admin.html.

create or replace function public.es_admin_actual()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p where p.id = auth.uid() and p.es_admin)
$$;

-- Acceso total del admin a cada tabla (se suma a las políticas existentes)
drop policy if exists admin_total on public.perfiles;
create policy admin_total on public.perfiles for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.sitios;
create policy admin_total on public.sitios for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.productos;
create policy admin_total on public.productos for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.articulos;
create policy admin_total on public.articulos for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.promociones;
create policy admin_total on public.promociones for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.cursos;
create policy admin_total on public.cursos for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.lecciones;
create policy admin_total on public.lecciones for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.documentos;
create policy admin_total on public.documentos for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.suscripciones;
create policy admin_total on public.suscripciones for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.accesos_documentos;
create policy admin_total on public.accesos_documentos for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
drop policy if exists admin_total on public.publicaciones;
create policy admin_total on public.publicaciones for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());

-- Usuarios con su email (auth.users no se expone por la API: sale por esta función)
create or replace function public.admin_usuarios()
returns table (id uuid, nombre text, email text, es_admin boolean, creado timestamptz,
               sitio_slug text, sitio_nombre text, plan text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin_actual() then return; end if;
  return query
    select p.id, p.nombre, u.email::text, p.es_admin, p.creado, s.slug, s.nombre, s.plan
    from public.perfiles p
    join auth.users u on u.id = p.id
    left join public.sitios s on s.dueno_id = p.id
    order by p.creado;
end $$;

-- Contadores generales de la plataforma
create or replace function public.admin_estadisticas()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.es_admin_actual() then return null; end if;
  select jsonb_build_object(
    'usuarios', (select count(*) from public.perfiles),
    'sitios', (select count(*) from public.sitios),
    'sitios_premium', (select count(*) from public.sitios where plan = 'premium'),
    'productos', (select count(*) from public.productos),
    'cursos', (select count(*) from public.cursos),
    'articulos', (select count(*) from public.articulos),
    'documentos', (select count(*) from public.documentos),
    'suscripciones_activas', (select count(*) from public.suscripciones where estado = 'activa'),
    'suscripciones_pendientes', (select count(*) from public.suscripciones where estado = 'pendiente'),
    'publicaciones', (select count(*) from public.publicaciones)
  ) into r;
  return r;
end $$;

-- ============================== configuración de la plataforma ==============================
-- Pares clave/valor editables desde la administración (hoy: portada_url del index).
-- Lectura pública (la landing la necesita sin login); escritura solo del admin.
create table if not exists public.config_plataforma (
  clave text primary key,
  valor text not null default '',
  actualizado timestamptz not null default now()
);
alter table public.config_plataforma enable row level security;
create policy config_lectura on public.config_plataforma
  for select to anon, authenticated using (true);
create policy config_admin on public.config_plataforma
  for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());

-- Dirección anterior del sitio: al cambiar el slug, la dirección vieja redirige a la nueva
-- (sitio.js y curso.js buscan por slug_anterior cuando el slug no existe).
alter table public.sitios add column if not exists slug_anterior text;

-- ============================================================ actualización 2026-11-26: utilidades de tienda
-- Rubro del sitio y configuración (sistema de talles, umbral de stock bajo),
-- y en productos: categoría, stock, talles con stock, precio de oferta y fin
-- de oferta (ofertas flash con cuenta regresiva en el sitio).
alter table public.sitios add column if not exists rubro text not null default 'general';
alter table public.sitios add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.productos add column if not exists categoria text not null default '';
alter table public.productos add column if not exists stock integer;
alter table public.productos add column if not exists variantes jsonb not null default '[]'::jsonb;
alter table public.productos add column if not exists precio_oferta numeric(12, 2);
alter table public.productos add column if not exists oferta_hasta timestamptz;

-- Diseño (maqueta) y color (tema) como ejes separados (2026-11-26): solo hay
-- dos diseños, 'clasica' y 'premium'; el tema guarda la paleta de color de
-- ese diseño. La paleta 'premium' pasó a llamarse 'dorado' y 'onix' se
-- eliminó (era casi idéntica a dorado).
alter table public.sitios add column if not exists maqueta text not null default 'clasica';
update public.sitios set maqueta = 'premium' where tema in ('premium','onix','medianoche','violeta','esmeralda','terracota');
update public.sitios set tema = 'dorado' where tema = 'premium';

-- ============================================================ miembros por sitio (2026-11-26)
-- La cuenta es de la plataforma, pero la membresía es de cada sitio: una
-- persona es miembro SOLO de los sitios donde se unió, se suscribió a un
-- curso o compró un documento. Los triggers la crean solos al suscribirse
-- o al recibir acceso a un documento.
create table if not exists public.miembros (
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  origen text not null default 'manual' check (origen in ('manual','suscripcion','compra','registro')),
  creado timestamptz not null default now(),
  primary key (sitio_id, usuario_id)
);
alter table public.miembros enable row level security;
create policy miembros_lectura on public.miembros for select to authenticated
  using (usuario_id = auth.uid() or public.es_dueno(sitio_id));
create policy miembros_unirse on public.miembros for insert to authenticated
  with check (usuario_id = auth.uid());
create policy miembros_salir on public.miembros for delete to authenticated
  using (usuario_id = auth.uid() or public.es_dueno(sitio_id));
create policy admin_total on public.miembros for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());

create or replace function public.registrar_miembro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.miembros (sitio_id, usuario_id, origen)
  values (new.sitio_id, new.alumno_id,
          case when tg_table_name = 'suscripciones' then 'suscripcion' else 'compra' end)
  on conflict (sitio_id, usuario_id) do nothing;
  return new;
end $$;
drop trigger if exists al_suscribir on public.suscripciones;
create trigger al_suscribir after insert on public.suscripciones
  for each row execute function public.registrar_miembro();
drop trigger if exists al_comprar on public.accesos_documentos;
create trigger al_comprar after insert on public.accesos_documentos
  for each row execute function public.registrar_miembro();
insert into public.miembros (sitio_id, usuario_id, origen, creado)
  select sitio_id, alumno_id, 'suscripcion', min(creada) from public.suscripciones
  group by sitio_id, alumno_id on conflict do nothing;
insert into public.miembros (sitio_id, usuario_id, origen, creado)
  select sitio_id, alumno_id, 'compra', min(creada) from public.accesos_documentos
  group by sitio_id, alumno_id on conflict do nothing;

-- 2026-11-26: foto de perfil del sitio (se muestra en un circulo en el hero)
alter table sitios add column if not exists avatar_url text;

-- 2026-11-27: categorias fijas por sitio. Se crean al vuelo desde el panel
-- al guardar un producto con una categoria nueva y quedan guardadas para
-- reutilizarlas; el panel tambien sugiere las que ya usan los productos.
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios(id) on delete cascade,
  nombre text not null,
  creada timestamptz not null default now(),
  unique (sitio_id, nombre)
);
alter table public.categorias enable row level security;
drop policy if exists categorias_lectura on public.categorias;
create policy categorias_lectura on public.categorias for select using (true);
drop policy if exists categorias_crud on public.categorias;
create policy categorias_crud on public.categorias for all
  using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));
drop policy if exists admin_total on public.categorias;
create policy admin_total on public.categorias for all to authenticated
  using (public.es_admin_actual()) with check (public.es_admin_actual());
insert into public.categorias (sitio_id, nombre)
  select distinct sitio_id, categoria from public.productos where categoria <> ''
  on conflict do nothing;

-- Comprobantes de pago que envian los alumnos (tabla 15, 2026-11-27).
-- El alumno sube el archivo a Cloudinary (api/firmar-comprobante.js) y
-- registra la fila; el maestro lo revisa en Panel > Comprobantes y al
-- aprobarlo se activa la suscripcion o el acceso al documento.
create table if not exists public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  alumno_id uuid not null references public.perfiles (id) on delete cascade,
  curso_id uuid references public.cursos (id) on delete set null,
  documento_id uuid references public.documentos (id) on delete set null,
  archivo_url text not null,
  nota text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  creado timestamptz not null default now()
);
alter table public.comprobantes enable row level security;
create policy comprobantes_alumno on public.comprobantes for select to authenticated using (alumno_id = auth.uid());
create policy comprobantes_enviar on public.comprobantes for insert to authenticated with check (alumno_id = auth.uid());
create policy comprobantes_dueno on public.comprobantes for select to authenticated using (public.es_dueno(sitio_id));
create policy comprobantes_dueno_edita on public.comprobantes for update to authenticated using (public.es_dueno(sitio_id)) with check (public.es_dueno(sitio_id));
create policy comprobantes_dueno_borra on public.comprobantes for delete to authenticated using (public.es_dueno(sitio_id));
create policy comprobantes_admin on public.comprobantes for all to authenticated using (public.es_admin_actual()) with check (public.es_admin_actual());

-- Codigos QR guardados del maestro (tabla 16, 2026-11-27).
-- Se guarda solo nombre + destino; la imagen se regenera en el panel.
create table if not exists public.qrs (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  nombre text not null,
  destino text not null,
  creado timestamptz not null default now()
);
alter table public.qrs enable row level security;
create policy qrs_dueno on public.qrs for select to authenticated using (public.es_dueno(sitio_id));
create policy qrs_dueno_crea on public.qrs for insert to authenticated with check (public.es_dueno(sitio_id));
create policy qrs_dueno_borra on public.qrs for delete to authenticated using (public.es_dueno(sitio_id));
create policy qrs_admin on public.qrs for all to authenticated using (public.es_admin_actual()) with check (public.es_admin_actual());

-- Metodos de pago por item y galerias (2026-11-27).
-- Cada item elige con pagos_modo: 'sitio' (los generales de
-- sitios.config.metodos_pago), 'propios' o 'ambos'. Un metodo es
-- { servicio, ambito: local|internacional, tipo: link|qr, url }.
alter table public.productos add column if not exists metodos_pago jsonb;
alter table public.productos add column if not exists pagos_modo text not null default 'sitio';
alter table public.productos add column if not exists instrucciones_pago text not null default '';
alter table public.productos add column if not exists galeria jsonb not null default '[]'::jsonb;
alter table public.cursos add column if not exists metodos_pago jsonb;
alter table public.cursos add column if not exists pagos_modo text not null default 'sitio';
alter table public.cursos add column if not exists instrucciones_pago text not null default '';
alter table public.cursos add column if not exists galeria jsonb not null default '[]'::jsonb;
alter table public.documentos add column if not exists metodos_pago jsonb;
alter table public.documentos add column if not exists pagos_modo text not null default 'sitio';
alter table public.documentos add column if not exists instrucciones_pago text not null default '';
alter table public.comprobantes add column if not exists producto_id uuid references public.productos (id) on delete set null;
