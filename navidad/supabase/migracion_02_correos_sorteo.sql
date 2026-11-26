-- by_kirco · Navidad — migración 02: correos (Resend), sorteo, cartas de reserva y notas.
-- Rama navidad-resend (26 nov 2026). NO APLICADA. Aplicar a mano en el SQL Editor de Supabase
-- (proyecto wpxsrzdlmcywynuftxzr) solo con el OK de Sara, y ANTES de desplegar el código de esta rama.
-- Es idempotente: se puede ejecutar dos veces sin romper nada.
-- No contiene secretos ni textos de cartas (las cartas de reserva se cargan aparte; ver README).

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) FIX: una carta rechazada ya no bloquea a la persona que había elegido.
--    Antes, el índice único ux_cartas_destino_elegido (destino_carta_id where not null) seguía
--    contando la carta rechazada, y esa persona quedaba "elegida" para siempre (ni la bolsa de
--    estado.js ni carta.js la ofrecían). Solución elegida (la más limpia): al rechazar, el
--    servidor pone destino_carta_id = null (api/navidad/panel-accion.js). El índice se queda igual.
--    Aquí solo se limpian las rechazadas que ya existan.
update public.cartas set destino_carta_id = null
 where estado = 'rechazada' and destino_carta_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Cartas de reserva (las escribe Toby; se cargan aparte con scripts/navidad/reservas_a_sql.js).
--    Privadas: nunca en el repo ni en una URL pública. Se usan solo si alguien se queda sin carta.
create table if not exists public.cartas_reserva (
  id text primary key check (id ~ '^R[0-9]{2,3}$'),
  texto text not null check (char_length(texto) between 80 and 3000),
  tematica text,
  usos integer not null default 0 check (usos >= 0),
  creada_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Columnas nuevas en cartas
--    recibe_reserva_id: la carta de reserva que recibe esta persona (si no recibe una de persona).
--    motivo_rechazo: el motivo que se le dice en el correo de "no aprobada" (M1/M2/M3 o texto M4).
alter table public.cartas add column if not exists recibe_reserva_id text references public.cartas_reserva(id);
alter table public.cartas add column if not exists motivo_rechazo text check (motivo_rechazo is null or char_length(motivo_rechazo) <= 300);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cartas_recibe_una_sola') then
    alter table public.cartas add constraint cartas_recibe_una_sola
      check (recibe_carta_id is null or recibe_reserva_id is null);
  end if;
end $$;
-- una carta de persona solo se entrega a una persona
create unique index if not exists ux_cartas_recibe_carta on public.cartas (recibe_carta_id) where recibe_carta_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Notas de agradecimiento: añadir el estado 'leida' (notas a Kirco, de cartas de reserva:
--    se quedan en el panel, nunca se reenvían por correo). Una nota por carta recibida
--    (carta_id = la fila de quien RECIBIÓ la carta y deja la nota; ya era unique).
alter table public.notas drop constraint if exists notas_estado_check;
alter table public.notas add constraint notas_estado_check check (estado in ('pendiente', 'reenviada', 'descartada', 'leida'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Cola de correos. No se guarda el cuerpo del correo (ni HTML ni texto): solo el estado.
create table if not exists public.correos (
  id uuid primary key default gen_random_uuid(),
  carta_id uuid not null references public.cartas(id),
  tipo text not null check (tipo in ('acuse', 'aprobada', 'rechazada', 'entrega', 'nota')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'programado', 'enviado', 'simulado', 'error')),
  programado_para timestamptz,
  resend_id text,
  intentos integer not null default 0,
  ultimo_error text,
  creado_at timestamptz not null default now(),
  enviado_at timestamptz
);
create unique index if not exists ux_correos_carta_tipo on public.correos (carta_id, tipo);
create index if not exists ix_correos_estado on public.correos (estado);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Sorteo: una sola fila por edición (2026). Guarda la semilla, la entrada (solo ids internos,
--    estados y agrupación por persona; sin correos ni textos) y el resultado, para poder
--    reproducirlo con scripts/navidad/verificar_sorteo.js y comparar la huella.
create table if not exists public.sorteos (
  id uuid primary key default gen_random_uuid(),
  edicion integer not null unique,
  ejecutado_at timestamptz not null default now(),
  participantes integer not null,
  cartas_persona integer not null,
  reservas_usadas integer not null,
  semilla text not null,
  entrada jsonb not null,
  resultado jsonb not null,
  huella_entrada text not null,
  huella_sha256 text not null,
  version_codigo text not null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) RLS sin políticas públicas (como en schema.sql) + permisos para el servidor.
alter table public.cartas_reserva enable row level security;
alter table public.correos enable row level security;
alter table public.sorteos enable row level security;
grant all on table public.cartas_reserva to service_role;
grant all on table public.correos to service_role;
grant all on table public.sorteos to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) Registro atómico del sorteo. El reparto se calcula en el servidor (api/navidad/_sorteo_core.js,
--    reproducible con la semilla); esta función lo guarda TODO en una sola transacción:
--    - bloqueo (advisory lock + lock de cartas) para que dos clics no hagan dos sorteos;
--    - si ya hay sorteo de esa edición, NO hace nada y devuelve el existente (idempotente);
--    - comprueba que las cartas no han cambiado desde que se calculó (mismos ids y estados);
--    - guarda el sorteo, las asignaciones (recibe_carta_id / recibe_reserva_id), los usos de
--      las reservas y deja en cola un correo 'entrega' por persona.
create or replace function public.navidad_registrar_sorteo(p_sorteo jsonb, p_asignaciones jsonb, p_usos jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existente public.sorteos;
  v_nuevo public.sorteos;
  a jsonb;
  v_cambios integer;
begin
  perform pg_advisory_xact_lock(hashtext('navidad_sorteo'));
  lock table public.cartas in share row exclusive mode;

  select * into v_existente from public.sorteos where edicion = (p_sorteo->>'edicion')::int;
  if found then
    return jsonb_build_object('ya_existia', true, 'sorteo', to_jsonb(v_existente) - 'entrada' - 'resultado');
  end if;

  -- la entrada con la que se calculó debe coincidir con lo que hay ahora
  select count(*) into v_cambios
    from public.cartas c
    full join jsonb_to_recordset(p_sorteo->'entrada'->'cartas') as e(id uuid, estado text) on e.id = c.id
   where c.id is null or e.id is null or c.estado is distinct from e.estado;
  if v_cambios > 0 then
    raise exception 'NAVIDAD_ENTRADA_CAMBIADA: las cartas han cambiado mientras se calculaba el sorteo';
  end if;

  insert into public.sorteos (edicion, participantes, cartas_persona, reservas_usadas, semilla, entrada, resultado,
                              huella_entrada, huella_sha256, version_codigo)
  values ((p_sorteo->>'edicion')::int, (p_sorteo->>'participantes')::int, (p_sorteo->>'cartas_persona')::int,
          (p_sorteo->>'reservas_usadas')::int, p_sorteo->>'semilla', p_sorteo->'entrada', p_sorteo->'resultado',
          p_sorteo->>'huella_entrada', p_sorteo->>'huella_sha256', p_sorteo->>'version_codigo')
  returning * into v_nuevo;

  for a in select * from jsonb_array_elements(p_asignaciones) loop
    update public.cartas
       set recibe_carta_id = case when a->>'tipo' = 'carta' then (a->>'id')::uuid end,
           recibe_reserva_id = case when a->>'tipo' = 'reserva' then a->>'id' end
     where id = (a->>'receptor')::uuid and recibe_carta_id is null and recibe_reserva_id is null;
    if not found then
      raise exception 'NAVIDAD_RECEPTOR_OCUPADO: %', a->>'receptor';
    end if;
    insert into public.correos (carta_id, tipo, estado, programado_para)
    values ((a->>'receptor')::uuid, 'entrega', 'pendiente', (p_sorteo->>'entrega_at')::timestamptz)
    on conflict (carta_id, tipo) do nothing;
  end loop;

  for a in select * from jsonb_array_elements(p_usos) loop
    update public.cartas_reserva set usos = usos + (a->>'veces')::int where id = a->>'id';
  end loop;

  return jsonb_build_object('ya_existia', false, 'sorteo', to_jsonb(v_nuevo) - 'entrada' - 'resultado');
end;
$$;

revoke all on function public.navidad_registrar_sorteo(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.navidad_registrar_sorteo(jsonb, jsonb, jsonb) to service_role;

commit;
