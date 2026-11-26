-- by_kirco · Navidad — esquema de Supabase
-- Proyecto actual: wpxsrzdlmcywynuftxzr (sustituye al antiguo By_kirco, lymmqtwywlqgaajnahjb, que quedó en pausa).
-- No contiene secretos: las claves van solo en variables de entorno de Vercel.

create extension if not exists pgcrypto;

create table if not exists cartas (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  correo text not null,
  seudonimo text not null,
  saludo text not null check (saludo in ('querido', 'querida', 'otro')),
  idea text,
  texto text,
  destino_carta_id uuid references cartas(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  recibe_carta_id uuid references cartas(id),
  enviada_25_at timestamptz,
  abierta_at timestamptz,
  motivo text,
  creada_at timestamptz not null default now(),
  acepto_18_privacidad_at timestamptz not null
);

-- Añadidas después de la primera entrega (seguro reaplicar: no falla si ya existen).
alter table cartas add column if not exists abierta_at timestamptz;
alter table cartas add column if not exists motivo text;

-- un correo solo puede tener una carta pendiente o aprobada a la vez
create unique index if not exists ux_cartas_correo_activo
  on cartas (correo)
  where estado in ('pendiente', 'aprobada');

-- una persona (carta aprobada) solo puede ser elegida como destino una vez
create unique index if not exists ux_cartas_destino_elegido
  on cartas (destino_carta_id)
  where destino_carta_id is not null;

-- Cartas de reserva: un banco de 20 cartas ya escritas y aprobadas de antemano, sin
-- remitente ni correo real, firmadas "Kirco". No participan en el buzón normal (no cuentan
-- para el límite de 300 ni aparecen en la bolsa de presentate.html): son solo una reserva
-- para cuando el reparto (fase futura) necesite dar una carta a alguien que, de otro modo,
-- se quedaría sin una (número impar de cartas, etc.). Por lo general no se deben usar.
create table if not exists cartas_reserva (
  id uuid primary key default gen_random_uuid(),
  tema text not null,
  texto text not null,
  usada boolean not null default false,
  usada_en_carta_id uuid references cartas(id),
  creada_at timestamptz not null default now()
);

create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  carta_id uuid not null unique references cartas(id),
  texto text not null check (char_length(texto) <= 300),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'reenviada', 'descartada')),
  creada_at timestamptz not null default now()
);

alter table cartas enable row level security;
alter table cartas_reserva enable row level security;
alter table notas enable row level security;
-- Sin políticas públicas a propósito: todo el acceso pasa por las funciones serverless
-- (/api/navidad/*) con la service role key, que ignora RLS. El panel de Sara (futuro)
-- hará lo mismo desde el servidor.

-- Importante: crear las tablas con SQL a mano no da permisos automáticos al rol
-- service_role (eso solo ocurre si se crean con el editor visual de Supabase).
-- Sin este GRANT, cualquier llamada desde el servidor falla con
-- "permission denied for table cartas/notas", aunque la clave y la URL sean correctas.
grant usage on schema public to service_role;
grant all on table public.cartas to service_role;
grant all on table public.cartas_reserva to service_role;
grant all on table public.notas to service_role;
