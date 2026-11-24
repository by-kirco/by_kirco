/* by_kirco · Navidad — cliente Supabase con service role.
   SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY viven solo como variables de entorno en Vercel; nunca en el repo. */
const { createClient } = require('@supabase/supabase-js');

let cliente = null;

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

module.exports = { getSupabase };
