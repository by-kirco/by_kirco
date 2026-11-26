/* by_kirco · Navidad — clientes Supabase.
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY viven solo como variables de
   entorno en Vercel; nunca en el repo. */
const { createClient } = require('@supabase/supabase-js');

let cliente = null;
let clienteAnon = null;

function getSupabase() {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del proyecto en Vercel.');
  }
  cliente = createClient(url, key, { auth: { persistSession: false } });
  return cliente;
}

/* Cliente con la clave pública (anon/publishable): es la que entiende el login de
   Supabase Auth (email + contraseña). Nunca se usa para leer/escribir cartas directamente. */
function getSupabaseAnon() {
  if (clienteAnon) return clienteAnon;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY en las variables de entorno del proyecto en Vercel.');
  }
  clienteAnon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return clienteAnon;
}

module.exports = { getSupabase, getSupabaseAnon };
