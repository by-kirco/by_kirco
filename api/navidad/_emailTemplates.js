/* by_kirco · Navidad — plantillas de email, en tablas con estilos inline (compatibles con
   Gmail/Outlook/Apple Mail). Basadas en el diseño de Emails.dc.html / EmailRetirada.dc.html.
   Todo el texto que viene de quien participa se escapa para que no inyecte HTML. */

const BASE = 'https://www.bykirco.com/navidad/assets';
const CALENDAR_URL = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Llega%20tu%20carta%20de%20un%20desconocido%20%F0%9F%92%9A&dates=20261224T230000Z/20261224T233000Z&details=Abre%20tu%20correo%3A%20te%20ha%20escrito%20alguien.%20bykirco.com';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function envoltorio(tituloHtml, cuerpoInteriorHtml, pieExtraHtml) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#1D2657">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1D2657">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;font-family:'Courier New',monospace;color:#FFFFFF">
  <tr><td style="background-color:#1D2657;background-image:url('${BASE}/email/nieve_email.gif');background-repeat:repeat-y;background-position:top center;padding:40px 32px 28px" align="center">
    <img src="${BASE}/img/logo_blanco.png" width="84" alt="by_kirco" style="display:block;width:84px;height:auto;margin:0 auto 22px">
    <h1 style="margin:0 0 24px;text-align:center;font-size:36px;line-height:1.15;color:#FFFFFF;font-family:Georgia,serif;font-weight:400">${tituloHtml}</h1>
    ${cuerpoInteriorHtml}
  </td></tr>
  <tr><td><img src="${BASE}/email/ola_email.png" width="600" height="30" alt="" style="display:block;width:100%;height:30px"></td></tr>
  <tr><td style="background:#6F9C3E;padding:20px 32px 28px" align="center">
    <a href="https://www.bykirco.com" style="font-family:'Courier New',monospace;font-size:16px;color:#FFFFFF;text-decoration:none">www.bykirco.com</a>
    <p style="margin:6px 0 0;font-size:12px;color:#FFFFFF">
      <a href="https://www.bykirco.com/navidad/legal.html" style="color:#FFFA7D">Política de privacidad</a>
    </p>
    ${pieExtraHtml || ''}
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function tarjeta(innerHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F1E3;border-radius:20px">
    <tr><td style="padding:26px 28px;color:#2E2B25;font-size:16px;line-height:1.6;font-family:'Courier New',monospace">${innerHtml}</td></tr>
  </table>`;
}

function boton(href, texto) {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:14px 32px;border-radius:999px;background:#FFFA7D;border:2px solid #2E2B25;color:#2E2B25;font-family:'Courier New',monospace;font-size:15px;text-decoration:none;text-transform:uppercase;letter-spacing:.03em">${texto}</a>`;
}

function plantillaAprobada({ seudonimo }) {
  const nombre = esc(seudonimo);
  const cuerpo = tarjeta(`
      <p style="margin:0 0 12px">Hola, ${nombre}:</p>
      <p style="margin:0 0 12px">Hemos leído tu carta y ya está dentro del buzón. Le llegará a alguien que no conoces.</p>
      <p style="margin:0 0 12px">La que escriban para ti te llegará a este correo el <strong>25 de diciembre a las 00:00</strong>.</p>
      <p style="margin:0 0 12px">Gracias por escribir.</p>
      <p style="margin:0">Sara, de by_kirco</p>
    `) + `<div align="center">${boton(CALENDAR_URL, 'Añadir al calendario')}</div>`;
  return {
    subject: 'Tu carta ya está dentro del buzón',
    html: envoltorio('Tu carta ya está<br>dentro del buzón', cuerpo)
  };
}

function plantillaRechazada({ seudonimo }) {
  const nombre = esc(seudonimo);
  const cuerpo = tarjeta(`
      <p style="margin:0 0 12px">Hola, ${nombre}:</p>
      <p style="margin:0 0 12px">Tu carta no ha podido salir porque hay algo en ella que no encaja con lo que cuidamos aquí.</p>
      <p style="margin:0 0 12px">No la va a leer nadie y no se ha guardado.</p>
      <p style="margin:0 0 12px">Si te apetece, puedes escribir otra antes del 23 de diciembre. Alguien la está esperando.</p>
      <p style="margin:0 0 12px">Gracias por querer escribir.</p>
      <p style="margin:0">Sara, de by_kirco</p>
    `) + `<div align="center">${boton('https://www.bykirco.com/navidad/presentate.html', 'Escribir otra carta')}
      <p style="margin:10px 0 0"><a href="https://www.bykirco.com/navidad/legal.html" style="color:#FFFA7D;font-size:14px">Ver nuestra política</a></p></div>`;
  return {
    subject: 'Esta carta no puede salir',
    html: envoltorio('Esta carta<br>no puede salir', cuerpo)
  };
}

function plantillaNotaReenviada({ textoNota, seudonimoDestinatario }) {
  const nota = esc(textoNota);
  const firma = esc(seudonimoDestinatario);
  const cuerpo = `<p style="margin:0 0 16px;text-align:center;color:#FFFFFF">Quien la recibió te ha dejado esto:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:repeating-linear-gradient(-45deg,#6F9C3E 0 12px,#F7F1E3 12px 20px,#FFAA4D 20px 32px,#F7F1E3 32px 40px);border-radius:20px">
      <tr><td style="padding:10px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F1E3;border-radius:12px">
          <tr><td style="padding:24px 26px;font-family:Georgia,serif;font-size:20px;line-height:1.5;color:#2E2B25">
            <p style="margin:0">${nota}</p>
            <p style="margin:8px 0 0;text-align:right">— ${firma}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
  return {
    subject: 'Alguien te da las gracias',
    html: envoltorio('Tu carta<br>ha llegado bien', cuerpo)
  };
}

module.exports = { plantillaAprobada, plantillaRechazada, plantillaNotaReenviada };
