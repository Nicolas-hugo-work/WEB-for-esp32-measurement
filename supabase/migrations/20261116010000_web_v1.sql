-- =====================================================================
-- Web v1: cambios que necesita la aplicación web (no borra nada).
--   B1  lecturas_serie(): serie agregada para gráficos de varias horas
--   B3  evaluar_sobreconsumo() devuelve también id_medidor (push con enlace)
--   B4  ultima_lectura eficiente (LATERAL ... LIMIT 1 por medidor)
--   P9  administradores del catálogo general
--   P5  ajustes_usuario (tarifa eléctrica en Bs/kWh)
-- =====================================================================

-- ---------------------------------------------------------------------
-- B4. Última lectura por medidor usando la PK (id_medidor, fecha_hora).
--     Mismas columnas que la vista anterior; respeta RLS de quien consulta.
-- ---------------------------------------------------------------------
create or replace view public.ultima_lectura with (security_invoker = true) as
select m.id_medidor, l.fecha_hora, l.corriente_a
from public.medidores_esp32 m
cross join lateral (
    select le.fecha_hora, le.corriente_a
    from public.lecturas_energia le
    where le.id_medidor = m.id_medidor
    order by le.fecha_hora desc
    limit 1
) l;

-- ---------------------------------------------------------------------
-- B1. Serie agregada por intervalos. Como máximo ~900 puntos (PostgREST
--     corta en 1000 filas): si p_seg es muy chico para el rango, se agranda.
-- ---------------------------------------------------------------------
create or replace function public.lecturas_serie(
    p_id_medidor bigint,
    p_desde      timestamptz,
    p_hasta      timestamptz,
    p_seg        int default 60)
returns table (t timestamptz, corriente_prom numeric, corriente_max numeric,
               corriente_min numeric, muestras int)
language sql
stable
security invoker
set search_path = ''
as $$
    select date_bin(
               make_interval(secs => greatest(
                   coalesce(p_seg, 60), 1,
                   ceil(extract(epoch from (p_hasta - p_desde)) / 900.0)::int)),
               l.fecha_hora,
               timestamptz '2000-01-01 00:00:00+00') as t,
           round(avg(l.corriente_a), 4),
           max(l.corriente_a),
           min(l.corriente_a),
           count(*)::int
    from public.lecturas_energia l
    where l.id_medidor = p_id_medidor
      and l.fecha_hora >= p_desde
      and l.fecha_hora <  p_hasta
    group by 1
    order by 1;
$$;

revoke all on function public.lecturas_serie(bigint, timestamptz, timestamptz, int) from public, anon;
grant execute on function public.lecturas_serie(bigint, timestamptz, timestamptz, int) to authenticated;

-- ---------------------------------------------------------------------
-- B3. Igual que antes, pero el jsonb incluye id_medidor.
-- ---------------------------------------------------------------------
create or replace function public.evaluar_sobreconsumo(
    p_id_medidor   bigint,
    p_enfriamiento interval default interval '30 minutes')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    a         record;
    v_umbral  numeric;
    v_fin     timestamptz;
    v_n       int;
    v_min     numeric;
    v_prom    numeric;
    v_alerta  bigint;
begin
    select ai.alerta_activa, ai.segundos_sostenido, ai.alias, m.id_usuario,
           coalesce(ai.umbral_corriente_a,
                    round(c.corriente_nominal_a * (1 + ai.margen_alerta_pct / 100.0), 3)) as umbral
      into a
    from public.aparatos_instalados ai
    join public.medidores_esp32 m on m.id_medidor = ai.id_medidor
    join public.catalogo_aparatos c on c.id_catalogo = ai.id_catalogo
    where ai.id_medidor = p_id_medidor;

    if not found or not a.alerta_activa then
        return null;
    end if;
    v_umbral := a.umbral;

    select max(l.fecha_hora) into v_fin
    from public.lecturas_energia l where l.id_medidor = p_id_medidor;
    if v_fin is null or v_fin < now() - interval '2 minutes' then
        return null;
    end if;

    select count(*), min(l.corriente_a), avg(l.corriente_a)
      into v_n, v_min, v_prom
    from public.lecturas_energia l
    where l.id_medidor = p_id_medidor
      and l.fecha_hora >  v_fin - make_interval(secs => a.segundos_sostenido)
      and l.fecha_hora <= v_fin;

    if v_n < ceil(a.segundos_sostenido * 0.8) or v_min <= v_umbral then
        return null;
    end if;

    if exists (select 1 from public.alertas x
               where x.id_medidor = p_id_medidor
                 and x.fecha_hora > now() - p_enfriamiento) then
        return null;
    end if;

    insert into public.alertas (id_medidor, corriente_a, umbral_a)
    values (p_id_medidor, round(v_prom, 4), v_umbral)
    returning id_alerta into v_alerta;

    return jsonb_build_object('id_alerta', v_alerta,
                              'id_medidor', p_id_medidor,
                              'id_usuario', a.id_usuario,
                              'alias', a.alias,
                              'corriente_a', round(v_prom, 4),
                              'umbral_a', v_umbral);
end;
$$;

revoke all on function public.evaluar_sobreconsumo(bigint, interval) from public, anon, authenticated;
grant execute on function public.evaluar_sobreconsumo(bigint, interval) to service_role;

-- ---------------------------------------------------------------------
-- P9. Administradores: pueden crear, editar y borrar el catálogo GENERAL.
--     Se asignan solo por SQL:
--       insert into public.administradores (id_usuario)
--       select id from auth.users where email = 'tu@correo';
-- ---------------------------------------------------------------------
create table public.administradores (
    id_usuario uuid primary key references auth.users (id) on delete cascade,
    creado_en  timestamptz not null default now()
);
alter table public.administradores enable row level security;
revoke all on public.administradores from anon, authenticated;
grant select on public.administradores to authenticated;
create policy administradores_ver_propio on public.administradores
    for select to authenticated using (id_usuario = (select auth.uid()));

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (select 1 from public.administradores a
                   where a.id_usuario = (select auth.uid()));
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

create policy catalogo_admin_crear on public.catalogo_aparatos
    for insert to authenticated
    with check (id_usuario is null and (select public.es_admin()));
create policy catalogo_admin_editar on public.catalogo_aparatos
    for update to authenticated
    using      (id_usuario is null and (select public.es_admin()))
    with check (id_usuario is null and (select public.es_admin()));
create policy catalogo_admin_borrar on public.catalogo_aparatos
    for delete to authenticated
    using (id_usuario is null and (select public.es_admin()));

-- ---------------------------------------------------------------------
-- P5. Ajustes por usuario: tarifa para estimar el costo (Bs por kWh).
--     0,80 Bs/kWh es un valor orientativo: cada usuario pone el de su factura.
-- ---------------------------------------------------------------------
create table public.ajustes_usuario (
    id_usuario     uuid primary key default auth.uid()
                   references auth.users (id) on delete cascade,
    tarifa_bs_kwh  numeric(6,3) not null default 0.80
                   check (tarifa_bs_kwh > 0 and tarifa_bs_kwh < 100),
    actualizado_en timestamptz not null default now()
);
alter table public.ajustes_usuario enable row level security;
revoke all on public.ajustes_usuario from anon, authenticated;
grant select, insert, update on public.ajustes_usuario to authenticated;
create policy ajustes_propios on public.ajustes_usuario
    for all to authenticated
    using      (id_usuario = (select auth.uid()))
    with check (id_usuario = (select auth.uid()));
