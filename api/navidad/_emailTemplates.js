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
    <h1 style="margin:0 0 24px;text-align:center;font-size:40px;line-height:1.2;color:#FFFFFF;font-family:'Courier New',monospace;font-weight:700">${tituloHtml}</h1>
    ${cuerpoInteriorHtml}
  </td></tr>
  <tr><td><img src="${BASE}/email/ola_email.png" width="600" height="30" alt="" style="display:block;width:100%;height:30px"></td></tr>
</table>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#6F9C3E">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;font-family:'Courier New',monospace;color:#FFFFFF">
  <tr><td style="padding:20px 32px 28px" align="center">
    <a href="https://www.bykirco.com" style="font-family:'Courier New',monospace;font-size:16px;color:#FFFFFF;text-decoration:none">www.bykirco.com</a>
    <p style="margin:10px 0 0;font-size:12px;color:#FFFFFF">
      Recibes este correo porque has escrito una carta en by_kirco.<br>
      Cómo cuidamos tus datos: <a href="https://www.bykirco.com/navidad/legal.html" style="color:#FFFA7D">bykirco.com/navidad/legal.html</a>
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
      <p style="margin:0 0 12px">Ya hemos leído tu carta y está lista para salir. 🎉</p>
      <p style="margin:0 0 12px">La guardo hasta el 25 de diciembre. Esa noche, a las 00:00, le llegará a alguien que no conoces, firmada con tu seudónimo.</p>
      <p style="margin:0 0 12px">Esa misma noche te llega la tuya, a este correo.</p>
      <p style="margin:0 0 4px">Kirco</p>
      <p style="margin:0;font-size:14px;color:#6b6557">Escribo para ti sin conocerte.</p>
    `) + `<div align="center">${boton(CALENDAR_URL, 'Añadir al calendario')}</div>`;
  return {
    subject: `${seudonimo}, tu carta ya está en nuestro buzón navideño 🎉`,
    html: envoltorio('Tu carta ya está<br>en el buzón', cuerpo)
  };
}

function plantillaRechazada({ seudonimo, motivo }) {
  const nombre = esc(seudonimo);
  const porque = esc(motivo || 'Hay algo en ella que no encaja con lo que cuidamos aquí.');
  const cuerpo = tarjeta(`
      <p style="margin:0 0 12px">Hola, ${nombre}:</p>
      <p style="margin:0 0 12px">Hemos leído tu carta y esta vez no podemos enviarla. ${porque}</p>
      <p style="margin:0 0 12px">Lamentablemente no podemos mandarte una carta el 25 de diciembre 😔: solo le llega a quien ha escrito una que cumple nuestras políticas.</p>
      <p style="margin:0 0 12px">Si quieres recibir una, escribe otra antes del 23 de diciembre a las 23:59 y que esta sí las cumpla.</p>
      <p style="margin:0 0 12px">Gracias por sentarte a escribir.</p>
      <p style="margin:0 0 4px">Kirco</p>
      <p style="margin:0;font-size:14px;color:#6b6557">Escribo para ti sin conocerte.</p>
    `) + `<div align="center">${boton('https://www.bykirco.com/navidad/presentate.html', 'Escribir otra carta')}</div>`;
  return {
    subject: `${seudonimo}, esta vez tu carta no puede salir`,
    html: envoltorio('Esta carta<br>no puede salir', cuerpo)
  };
}

function plantillaEntrega({ seudonimo, enlaceCarta, bloqueSiAprobada }) {
  const nombre = esc(seudonimo);
  const extra = bloqueSiAprobada ? '<p style="margin:0 0 12px">Y la tuya también ha llegado esta noche a alguien.</p>' : '';
  const cuerpo = tarjeta(`
      <p style="margin:0 0 12px">Hola, ${nombre}:</p>
      <p style="margin:0 0 12px">Ya es 25. Alguien que no conoces te ha escrito una carta, y la tienes aquí:</p>
    `) + `<div align="center">${boton(enlaceCarta, 'Abrir mi carta')}
      <p style="margin:10px 0 0;font-size:13px;color:#FFFFFF">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="${enlaceCarta}" style="color:#FFFA7D">${esc(enlaceCarta)}</a></p></div>` +
    tarjeta(`
      <p style="margin:0 0 12px">Ábrela cuando te apetezca, con calma.</p>
      ${extra}
      <p style="margin:0 0 4px">Kirco</p>
      <p style="margin:0;font-size:14px;color:#6b6557">Escribo para ti sin conocerte.</p>
    `);
  return {
    subject: `🎄 Feliz Navidad, ${seudonimo}. Alguien te ha escrito esto para ti 💌💚`,
    html: envoltorio('Alguien ha<br>pensado en ti', cuerpo)
  };
}

function plantillaNotaReenviada({ seudonimo, textoNota, seudonimoDestinatario }) {
  const nombre = esc(seudonimo);
  const nota = esc(textoNota);
  const firma = esc(seudonimoDestinatario);
  const cuerpo = `<p style="margin:0 0 16px;text-align:center;color:#FFFFFF">Hola, ${nombre}: quien la recibió te ha dejado esto:</p>
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

module.exports = { plantillaAprobada, plantillaRechazada, plantillaEntrega, plantillaNotaReenviada };
