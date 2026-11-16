-- =====================================================================
-- Recalibrar el cero desde la web (el hardware no tiene botones).
-- La web marca recalibrar_solicitado = true; en el próximo lote, ingest
-- responde {"recalibrar": true} y limpia la marca; el ESP32 recalibra.
-- =====================================================================

alter table public.medidores_esp32
    add column recalibrar_solicitado boolean not null default false;

grant update (recalibrar_solicitado) on public.medidores_esp32 to authenticated;

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
    v_recal  boolean := false;
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

    -- Entrega la solicitud de recalibración (una sola vez) y la limpia.
    select m.recalibrar_solicitado into v_recal
    from public.medidores_esp32 m
    where m.id_medidor = v_id
    for update;

    update public.medidores_esp32
    set ultima_conexion       = now(),
        firmware_version      = coalesce(p_firmware, firmware_version),
        recalibrar_solicitado = false
    where id_medidor = v_id;

    if v_n > 0 then
        v_alerta := public.evaluar_sobreconsumo(v_id);
    end if;

    return jsonb_build_object('estado', 'ok', 'insertadas', v_n, 'alerta', v_alerta,
                              'recalibrar', coalesce(v_recal, false));
end;
$$;

revoke all on function public.ingestar_lotes(text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.ingestar_lotes(text, jsonb, jsonb, text) to service_role;
