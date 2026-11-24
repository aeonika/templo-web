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
