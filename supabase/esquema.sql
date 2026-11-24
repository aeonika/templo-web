-- TemploWeb · Esquema de Supabase (Postgres)
-- Ejecutar completo en el SQL Editor del proyecto Supabase.
-- Seguridad: todo el acceso pasa por RLS. La clave anonima solo puede
-- hacer lo que estas politicas permiten.

create extension if not exists pgcrypto;

-- ============================================================ perfiles
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  creado timestamptz not null default now()
);

create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''))
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
  select id, sitio_id, titulo, descripcion, precio, moneda, link_pago, creado
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
