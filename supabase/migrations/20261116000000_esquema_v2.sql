-- =====================================================================
-- Esquema v2 - Medidor de corriente ESP32 + web multiusuario (Supabase)
--
-- ATENCION: la sección 0 BORRA las tablas anteriores y sus datos de
-- prueba (lecturas_energia, medidores_esp32, aparatos_instalados,
-- catalogo_aparatos) y la vista ultima_lectura.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Limpieza del esquema anterior
-- ---------------------------------------------------------------------
drop view  if exists public.ultima_lectura;
drop table if exists public.aparatos_instalados cascade;
drop table if exists public.lecturas_energia    cascade;
drop table if exists public.medidores_esp32     cascade;
drop table if exists public.catalogo_aparatos   cascade;

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------

-- Dónde está cada aparato ("Cocina", "Taller"...). Una lista por usuario.
create table public.ubicaciones (
    id_ubicacion bigint generated always as identity primary key,
    id_usuario   uuid not null references auth.users (id) on delete cascade,
    nombre       text not null check (length(trim(nombre)) > 0),
    unique (id_usuario, nombre)
);

-- Catálogo: id_usuario NULL = general (todos lo ven); con id_usuario = privado.
create table public.catalogo_aparatos (
    id_catalogo         bigint generated always as identity primary key,
    id_usuario          uuid references auth.users (id) on delete cascade,
    es_global           boolean generated always as (id_usuario is null) stored,
    tipo                text not null check (length(trim(tipo)) > 0),
    marca               text,
    modelo              text,
    potencia_nominal_w  numeric(8,1) not null check (potencia_nominal_w > 0),
    voltaje_nominal_v   numeric(5,1) not null default 220 check (voltaje_nominal_v > 0),
    corriente_nominal_a numeric(8,3) generated always as
                        (round(potencia_nominal_w / voltaje_nominal_v, 3)) stored
);
create index on public.catalogo_aparatos (id_usuario);

-- Un ESP32 = un medidor = un aparato. El token en claro solo vive en el ESP32.
create table public.medidores_esp32 (
    id_medidor       bigint generated always as identity primary key,
    id_usuario       uuid not null references auth.users (id) on delete cascade,
    mac_address      macaddr not null unique,
    nombre           text,
    token_hash       text not null unique,          -- SHA-256 (hex) del token
    firmware_version text,
    ultima_conexion  timestamptz,
    activo           boolean not null default true,
    creado_en        timestamptz not null default now()
);
create index on public.medidores_esp32 (id_usuario);

-- Qué aparato hay en cada medidor, dónde está y cómo se alerta.
create table public.aparatos_instalados (
    id_aparato          bigint generated always as identity primary key,
    id_medidor          bigint not null unique
                        references public.medidores_esp32 (id_medidor) on delete cascade,
    id_catalogo         bigint not null references public.catalogo_aparatos (id_catalogo),
    id_ubicacion        bigint references public.ubicaciones (id_ubicacion) on delete set null,
    alias               text,
    alerta_activa       boolean  not null default true,
    umbral_corriente_a  numeric(8,3) check (umbral_corriente_a > 0),  -- NULL = nominal + margen
    margen_alerta_pct   smallint not null default 20 check (margen_alerta_pct >= 0),
    segundos_sostenido  smallint not null default 30 check (segundos_sostenido between 1 and 600)
);
create index on public.aparatos_instalados (id_catalogo);
create index on public.aparatos_instalados (id_ubicacion);

-- Códigos de vinculación que genera la web (vencen en 15 minutos, un solo uso).
create table public.codigos_vinculacion (
    id_codigo    bigint generated always as identity primary key,
    id_usuario   uuid not null references auth.users (id) on delete cascade,
    codigo       text not null unique check (codigo ~ '^[2-9A-HJKMNP-Z]{8}$'),
    id_catalogo  bigint not null references public.catalogo_aparatos (id_catalogo) on delete cascade,
    id_ubicacion bigint references public.ubicaciones (id_ubicacion) on delete set null,
    alias        text,
    creado_en    timestamptz not null default now(),
    expira_en    timestamptz not null default now() + interval '15 minutes',
    usado_en     timestamptz,
    id_medidor   bigint references public.medidores_esp32 (id_medidor) on delete set null
);
create index on public.codigos_vinculacion (id_usuario);
create index on public.codigos_vinculacion (id_catalogo);
create index on public.codigos_vinculacion (id_ubicacion);
create index on public.codigos_vinculacion (id_medidor);

-- Lecturas en bruto (solo corriente), 1 por segundo. La PK evita duplicados.
create table public.lecturas_energia (
    id_medidor  bigint not null references public.medidores_esp32 (id_medidor) on delete cascade,
    fecha_hora  timestamptz not null default now(),
    corriente_a numeric(8,4) not null check (corriente_a >= 0),
    primary key (id_medidor, fecha_hora)
);

-- Resumen por hora (se conserva para siempre; las lecturas en bruto se purgan).
create table public.lecturas_hora (
    id_medidor     bigint not null references public.medidores_esp32 (id_medidor) on delete cascade,
    hora           timestamptz not null,
    corriente_prom numeric(8,4) not null,
    corriente_max  numeric(8,4) not null,
    corriente_min  numeric(8,4) not null,
    muestras       integer not null,
    primary key (id_medidor, hora)
);

-- Fallas de hardware: solo se registra cuando hay falla.
create table public.fallas_hardware (
    id_falla    bigint generated always as identity primary key,
    id_medidor  bigint not null references public.medidores_esp32 (id_medidor) on delete cascade,
    codigo      text not null check (codigo in
                ('REVISAR_DIVISOR','FUERA_RANGO_ADC','SIN_CALIBRAR_CERO','CERO_FALLIDO')),
    bias_v      numeric(5,3),
    fecha_hora  timestamptz not null default now()
);
create index on public.fallas_hardware (id_medidor, fecha_hora desc);

-- Alertas de sobreconsumo.
create table public.alertas (
    id_alerta   bigint generated always as identity primary key,
    id_medidor  bigint not null references public.medidores_esp32 (id_medidor) on delete cascade,
    tipo        text not null default 'SOBRECONSUMO',
    corriente_a numeric(8,4) not null,
    umbral_a    numeric(8,3) not null,
    fecha_hora  timestamptz not null default now(),
    leida       boolean not null default false
);
create index on public.alertas (id_medidor, fecha_hora desc);

-- Suscripciones de notificaciones push (Web Push) de cada navegador.
create table public.push_suscripciones (
    id_suscripcion bigint generated always as identity primary key,
    id_usuario     uuid not null references auth.users (id) on delete cascade,
    endpoint       text not null unique,
    p256dh         text not null,
    auth           text not null,
    user_agent     text,
    creado_en      timestamptz not null default now()
);
create index on public.push_suscripciones (id_usuario);

-- ---------------------------------------------------------------------
-- 2. Funciones
-- ---------------------------------------------------------------------

-- La web llama a esta función (usuario logueado) para obtener un código.
create or replace function public.generar_codigo_vinculacion(
    p_id_catalogo  bigint,
    p_id_ubicacion bigint default null,
    p_alias        text   default null)
returns table (codigo_generado text, vence_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid      uuid := (select auth.uid());
    v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   -- 31 símbolos, sin I L O 0 1
    v_pos      constant int[] := array[0,1,2,3,4,5,9,10];            -- bytes 100% aleatorios del uuid v4
    v_bytes    bytea;
    v_codigo   text;
    v_i        int;
    v_expira   timestamptz := now() + interval '15 minutes';
begin
    if v_uid is null then
        raise exception 'no autenticado' using errcode = '28000';
    end if;
    if not exists (select 1 from public.catalogo_aparatos c
                   where c.id_catalogo = p_id_catalogo
                     and (c.id_usuario is null or c.id_usuario = v_uid)) then
        raise exception 'aparato no disponible';
    end if;
    if p_id_ubicacion is not null and not exists (
           select 1 from public.ubicaciones u
           where u.id_ubicacion = p_id_ubicacion and u.id_usuario = v_uid) then
        raise exception 'ubicacion no valida';
    end if;

    delete from public.codigos_vinculacion where expira_en < now() - interval '1 day';
    if (select count(*) from public.codigos_vinculacion
        where id_usuario = v_uid and usado_en is null and expira_en > now()) >= 5 then
        raise exception 'demasiados codigos activos';
    end if;

    loop
        v_bytes  := uuid_send(gen_random_uuid());
        v_codigo := '';
        for v_i in 1..8 loop
            v_codigo := v_codigo || substr(v_alfabeto, 1 + (get_byte(v_bytes, v_pos[v_i]) % 31), 1);
        end loop;
        begin
            insert into public.codigos_vinculacion
                   (id_usuario, codigo, id_catalogo, id_ubicacion, alias, expira_en)
            values (v_uid, v_codigo, p_id_catalogo, p_id_ubicacion, nullif(trim(p_alias), ''), v_expira);
            exit;
        exception when unique_violation then
            null;   -- código repetido: generar otro
        end;
    end loop;

    return query select v_codigo, v_expira;
end;
$$;

-- La Edge Function "vincular-dispositivo" llama a esta (solo service_role).
create or replace function public.vincular_medidor(
    p_codigo     text,
    p_mac        macaddr,
    p_firmware   text,
    p_token_hash text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v    public.codigos_vinculacion%rowtype;
    v_id bigint;
begin
    select * into v
    from public.codigos_vinculacion
    where codigo = upper(trim(p_codigo)) and usado_en is null and expira_en > now()
    for update;
    if not found then
        return null;
    end if;

    -- Si ese ESP32 pasa a otro usuario, se borra el medidor viejo y su historial.
    delete from public.medidores_esp32
    where mac_address = p_mac and id_usuario <> v.id_usuario;

    insert into public.medidores_esp32
           (id_usuario, mac_address, nombre, token_hash, firmware_version, ultima_conexion, activo)
    values (v.id_usuario, p_mac, v.alias, p_token_hash, p_firmware, now(), true)
    on conflict (mac_address) do update
        set token_hash       = excluded.token_hash,
            firmware_version = excluded.firmware_version,
            nombre           = excluded.nombre,
            ultima_conexion  = now(),
            activo           = true
    returning id_medidor into v_id;

    insert into public.aparatos_instalados (id_medidor, id_catalogo, id_ubicacion, alias)
    values (v_id, v.id_catalogo, v.id_ubicacion, v.alias)
    on conflict (id_medidor) do update
        set id_catalogo  = excluded.id_catalogo,
            id_ubicacion = excluded.id_ubicacion,
            alias        = excluded.alias;

    update public.codigos_vinculacion
    set usado_en = now(), id_medidor = v_id
    where id_codigo = v.id_codigo;

    return v_id;
end;
$$;

-- Revisa si el aparato lleva N segundos seguidos sobre su umbral.
-- Devuelve un jsonb con la alerta creada, o NULL si no hay alerta.
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
                              'id_usuario', a.id_usuario,
                              'alias', a.alias,
                              'corriente_a', round(v_prom, 4),
                              'umbral_a', v_umbral);
end;
$$;

-- La Edge Function "ingest" llama a esta (solo service_role).
-- p_lecturas: [{"dt": segundos_atras, "a": corriente}, ...]
-- p_falla:    {"codigo": "...", "bias_v": 1.23}  (opcional)
create or replace function public.ingestar_lotes(
    p_token_hash text,
    p_lecturas   jsonb,
    p_falla      jsonb default null,
    p_firmware   text  default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id     bigint;
    v_n      int := 0;
    v_codigo text;
    v_bias   numeric;
    v_alerta jsonb := null;
begin
    select m.id_medidor into v_id
    from public.medidores_esp32 m
    where m.token_hash = p_token_hash and m.activo;
    if v_id is null then
        return jsonb_build_object('estado', 'no_autorizado');
    end if;

    if p_lecturas is not null and jsonb_typeof(p_lecturas) = 'array' then
        if jsonb_array_length(p_lecturas) > 120 then
            return jsonb_build_object('estado', 'lote_muy_grande');
        end if;
        insert into public.lecturas_energia (id_medidor, fecha_hora, corriente_a)
        select v_id, date_trunc('second', now() - make_interval(secs => x.dt)), x.a
        from jsonb_to_recordset(p_lecturas) as x(dt numeric, a numeric)
        where x.dt between 0 and 3600 and x.a between 0 and 500
        on conflict (id_medidor, fecha_hora) do nothing;
        get diagnostics v_n = row_count;
    end if;

    if p_falla is not null and jsonb_typeof(p_falla) = 'object' then
        v_codigo := p_falla ->> 'codigo';
        v_bias   := nullif(p_falla ->> 'bias_v', '')::numeric;
        if v_bias is not null and (v_bias < 0 or v_bias >= 100) then
            v_bias := null;
        end if;
        if v_codigo in ('REVISAR_DIVISOR','FUERA_RANGO_ADC','SIN_CALIBRAR_CERO','CERO_FALLIDO')
           and not exists (select 1 from public.fallas_hardware f
                           where f.id_medidor = v_id and f.codigo = v_codigo
                             and f.fecha_hora > now() - interval '5 minutes') then
            insert into public.fallas_hardware (id_medidor, codigo, bias_v)
            values (v_id, v_codigo, v_bias);
        end if;
    end if;

    update public.medidores_esp32
    set ultima_conexion  = now(),
        firmware_version = coalesce(p_firmware, firmware_version)
    where id_medidor = v_id;

    if v_n > 0 then
        v_alerta := public.evaluar_sobreconsumo(v_id);
    end if;

    return jsonb_build_object('estado', 'ok', 'insertadas', v_n, 'alerta', v_alerta);
end;
$$;

-- Mantenimiento: resumen por hora y purga de lecturas en bruto.
create or replace function public.resumir_lecturas_hora()
returns void
language sql
security definer
set search_path = ''
as $$
    insert into public.lecturas_hora
           (id_medidor, hora, corriente_prom, corriente_max, corriente_min, muestras)
    select l.id_medidor, date_trunc('hour', l.fecha_hora),
           round(avg(l.corriente_a), 4), max(l.corriente_a), min(l.corriente_a), count(*)
    from public.lecturas_energia l
    where l.fecha_hora >= date_trunc('hour', now()) - interval '48 hours'
      and l.fecha_hora <  date_trunc('hour', now())
    group by l.id_medidor, date_trunc('hour', l.fecha_hora)
    on conflict (id_medidor, hora) do update
        set corriente_prom = excluded.corriente_prom,
            corriente_max  = excluded.corriente_max,
            corriente_min  = excluded.corriente_min,
            muestras       = excluded.muestras;
$$;

create or replace function public.purgar_lecturas(p_dias int default 3)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    n bigint;
begin
    if p_dias < 2 then
        raise exception 'p_dias debe ser >= 2 (el resumen por hora revisa las ultimas 48 h)';
    end if;
    perform public.resumir_lecturas_hora();
    delete from public.lecturas_energia
    where fecha_hora < now() - make_interval(days => p_dias);
    get diagnostics n = row_count;
    return n;
end;
$$;

-- Última lectura por medidor (respeta RLS de quien consulta).
create view public.ultima_lectura with (security_invoker = true) as
select distinct on (id_medidor) id_medidor, fecha_hora, corriente_a
from public.lecturas_energia
order by id_medidor, fecha_hora desc;

-- ---------------------------------------------------------------------
-- 3. Permisos de funciones
-- ---------------------------------------------------------------------
revoke all on function public.generar_codigo_vinculacion(bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.generar_codigo_vinculacion(bigint, bigint, text) to authenticated;

revoke all on function public.vincular_medidor(text, macaddr, text, text)      from public, anon, authenticated;
revoke all on function public.evaluar_sobreconsumo(bigint, interval)           from public, anon, authenticated;
revoke all on function public.ingestar_lotes(text, jsonb, jsonb, text)         from public, anon, authenticated;
revoke all on function public.resumir_lecturas_hora()                          from public, anon, authenticated;
revoke all on function public.purgar_lecturas(int)                             from public, anon, authenticated;
grant execute on function public.vincular_medidor(text, macaddr, text, text)   to service_role;
grant execute on function public.evaluar_sobreconsumo(bigint, interval)        to service_role;
grant execute on function public.ingestar_lotes(text, jsonb, jsonb, text)      to service_role;
grant execute on function public.resumir_lecturas_hora()                       to service_role;
grant execute on function public.purgar_lecturas(int)                          to service_role;

-- ---------------------------------------------------------------------
-- 4. Permisos de tablas (mínimos) y RLS
--    El navegador solo lee y edita lo suyo; escribir lecturas, fallas y
--    medidores lo hacen las funciones de arriba.
-- ---------------------------------------------------------------------
revoke all on public.ubicaciones, public.catalogo_aparatos, public.medidores_esp32,
              public.aparatos_instalados, public.codigos_vinculacion, public.lecturas_energia,
              public.lecturas_hora, public.fallas_hardware, public.alertas,
              public.push_suscripciones, public.ultima_lectura
    from anon, authenticated;

grant select, insert, update, delete on public.ubicaciones        to authenticated;
grant select, insert, update, delete on public.catalogo_aparatos  to authenticated;
grant select, insert, update, delete on public.push_suscripciones to authenticated;
grant select, delete                 on public.medidores_esp32    to authenticated;
grant update (nombre, activo)        on public.medidores_esp32    to authenticated;
grant select                         on public.aparatos_instalados to authenticated;
grant update (id_catalogo, id_ubicacion, alias, alerta_activa,
              umbral_corriente_a, margen_alerta_pct, segundos_sostenido)
                                     on public.aparatos_instalados to authenticated;
grant select                         on public.codigos_vinculacion to authenticated;
grant select                         on public.lecturas_energia    to authenticated;
grant select                         on public.lecturas_hora       to authenticated;
grant select                         on public.fallas_hardware     to authenticated;
grant select                         on public.alertas             to authenticated;
grant update (leida)                 on public.alertas             to authenticated;
grant select                         on public.ultima_lectura      to authenticated;

alter table public.ubicaciones         enable row level security;
alter table public.catalogo_aparatos   enable row level security;
alter table public.medidores_esp32     enable row level security;
alter table public.aparatos_instalados enable row level security;
alter table public.codigos_vinculacion enable row level security;
alter table public.lecturas_energia    enable row level security;
alter table public.lecturas_hora       enable row level security;
alter table public.fallas_hardware     enable row level security;
alter table public.alertas             enable row level security;
alter table public.push_suscripciones  enable row level security;

create policy ubicaciones_propias on public.ubicaciones
    for all to authenticated
    using      (id_usuario = (select auth.uid()))
    with check (id_usuario = (select auth.uid()));

create policy catalogo_ver on public.catalogo_aparatos
    for select to authenticated
    using (id_usuario is null or id_usuario = (select auth.uid()));
create policy catalogo_crear on public.catalogo_aparatos
    for insert to authenticated
    with check (id_usuario = (select auth.uid()));
create policy catalogo_editar on public.catalogo_aparatos
    for update to authenticated
    using      (id_usuario = (select auth.uid()))
    with check (id_usuario = (select auth.uid()));
create policy catalogo_borrar on public.catalogo_aparatos
    for delete to authenticated
    using (id_usuario = (select auth.uid()));

create policy medidores_ver on public.medidores_esp32
    for select to authenticated using (id_usuario = (select auth.uid()));
create policy medidores_editar on public.medidores_esp32
    for update to authenticated
    using      (id_usuario = (select auth.uid()))
    with check (id_usuario = (select auth.uid()));
create policy medidores_borrar on public.medidores_esp32
    for delete to authenticated using (id_usuario = (select auth.uid()));

create policy aparatos_ver on public.aparatos_instalados
    for select to authenticated
    using (exists (select 1 from public.medidores_esp32 m
                   where m.id_medidor = aparatos_instalados.id_medidor
                     and m.id_usuario = (select auth.uid())));
create policy aparatos_editar on public.aparatos_instalados
    for update to authenticated
    using (exists (select 1 from public.medidores_esp32 m
                   where m.id_medidor = aparatos_instalados.id_medidor
                     and m.id_usuario = (select auth.uid())))
    with check (
        exists (select 1 from public.medidores_esp32 m
                where m.id_medidor = aparatos_instalados.id_medidor
                  and m.id_usuario = (select auth.uid()))
        and exists (select 1 from public.catalogo_aparatos c
                    where c.id_catalogo = aparatos_instalados.id_catalogo
                      and (c.id_usuario is null or c.id_usuario = (select auth.uid())))
        and (aparatos_instalados.id_ubicacion is null
             or exists (select 1 from public.ubicaciones u
                        where u.id_ubicacion = aparatos_instalados.id_ubicacion
                          and u.id_usuario = (select auth.uid()))));

create policy codigos_ver on public.codigos_vinculacion
    for select to authenticated using (id_usuario = (select auth.uid()));

create policy lecturas_ver on public.lecturas_energia
    for select to authenticated
    using (exists (select 1 from public.medidores_esp32 m
                   where m.id_medidor = lecturas_energia.id_medidor
                     and m.id_usuario = (select auth.uid())));

create policy lecturas_hora_ver on public.lecturas_hora
    for select to authenticated
    using (exists (select 1 from public.medidores_esp32 m
                   where m.id_medidor = lecturas_hora.id_medidor
                     and m.id_usuario = (select auth.uid())));

create policy fallas_ver on public.fallas_hardware
    for select to authenticated
    using (exists (select 1 from public.medidores_esp32 m
                   where m.id_medidor = fallas_hardware.id_medidor
                     and m.id_usuario = (select auth.uid())));

create policy alertas_ver on public.alertas
    for select to authenticated
    using (exists (select 1 from public.medidores_esp32 m
                   where m.id_medidor = alertas.id_medidor
                     and m.id_usuario = (select auth.uid())));
create policy alertas_marcar_leida on public.alertas
    for update to authenticated
    using (exists (select 1 from public.medidores_esp32 m
                   where m.id_medidor = alertas.id_medidor
                     and m.id_usuario = (select auth.uid())))
    with check (exists (select 1 from public.medidores_esp32 m
                        where m.id_medidor = alertas.id_medidor
                          and m.id_usuario = (select auth.uid())));

create policy push_propias on public.push_suscripciones
    for all to authenticated
    using      (id_usuario = (select auth.uid()))
    with check (id_usuario = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 5. Catálogo general de arranque (los 4 que ya tenías + algunos más;
--    los últimos 4 son valores orientativos, ajústalos)
-- ---------------------------------------------------------------------
insert into public.catalogo_aparatos (tipo, marca, modelo, potencia_nominal_w) values
    ('Refrigerador',       'Generica', 'Estandar',  150),
    ('Microondas',         'Generica', 'Estandar', 1200),
    ('Plancha',            'Generica', 'Estandar', 1000),
    ('Televisor',          'Generica', 'Estandar',  100),
    ('Foco LED',           'Generica', 'Estandar',   10),
    ('Ventilador',         'Generica', 'Estandar',   60),
    ('Lavadora',           'Generica', 'Estandar',  500),
    ('Aire acondicionado', 'Generica', 'Estandar', 1500);

-- ---------------------------------------------------------------------
-- 6. Tareas programadas (solo si pg_cron está disponible)
--    Hora en UTC: 07:15 UTC = 03:15 en Bolivia.
-- ---------------------------------------------------------------------
do $$
begin
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        create extension if not exists pg_cron;
        perform cron.unschedule(jobid) from cron.job
         where jobname in ('resumen-lecturas-hora', 'purgar-lecturas');
        perform cron.schedule('resumen-lecturas-hora', '5 * * * *',
                              'select public.resumir_lecturas_hora()');
        perform cron.schedule('purgar-lecturas', '15 7 * * *',
                              'select public.purgar_lecturas(3)');
    end if;
end
$$;
