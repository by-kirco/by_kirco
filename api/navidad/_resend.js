/* by_kirco · Navidad — envío de emails transaccionales con Resend.
   RESEND_API_KEY y EMAIL_FROM viven solo como variables de entorno en Vercel; nunca en el repo.
   Usa fetch nativo contra la API de Resend, sin añadir el SDK como dependencia. */

async function enviaEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'by_kirco <onboarding@resend.dev>';
  if (!apiKey) {
    console.error('_resend.js: falta RESEND_API_KEY en las variables de entorno.');
    return { ok: false, error: 'Falta configurar el envío de correos (RESEND_API_KEY).' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], subject, html })
    });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('_resend.js', { status: res.status, cuerpo });
      return { ok: false, error: (cuerpo && cuerpo.message) || `Resend respondió ${res.status}` };
    }
    return { ok: true, id: cuerpo.id };
  } catch (e) {
    console.error('_resend.js fallo de red', String(e));
    return { ok: false, error: 'No se pudo conectar con Resend.' };
  }
}

module.exports = { enviaEmail };
