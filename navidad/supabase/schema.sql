-- by_kirco · Navidad — esquema de Supabase
-- Aplicar en el proyecto "By_kirco" (lymmqtwywlqgaajnahjb) una vez esté activo.
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
  creada_at timestamptz not null default now(),
  acepto_18_privacidad_at timestamptz not null
);

-- un correo solo puede tener una carta pendiente o aprobada a la vez
create unique index if not exists ux_cartas_correo_activo
  on cartas (correo)
  where estado in ('pendiente', 'aprobada');

-- una persona (carta aprobada) solo puede ser elegida como destino una vez
create unique index if not exists ux_cartas_destino_elegido
  on cartas (destino_carta_id)
  where destino_carta_id is not null;

create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  carta_id uuid not null unique references cartas(id),
  texto text not null check (char_length(texto) <= 300),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'reenviada', 'descartada')),
  creada_at timestamptz not null default now()
);

alter table cartas enable row level security;
alter table notas enable row level security;
-- Sin políticas públicas a propósito: todo el acceso pasa por las funciones serverless
-- (/api/navidad/*) con la service role key, que ignora RLS. El panel de Sara (futuro)
-- hará lo mismo desde el servidor.
