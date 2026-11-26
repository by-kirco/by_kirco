/* by_kirco · Navidad — plantilla HTML de los correos (copiada de la plantilla genérica de by_kirco,
   /workspace/erin/plantillas_v2/plantilla_generica.html, 26 nov 2026): fondo naranja claro, caja blanca,
   firma corporativa KIRCO con el logo alojado en https://www.bykirco.com/assets/email/logo_bykirco.png.
   Los TEXTOS están en _textos_correo.js. Aquí solo se monta el HTML y el texto plano.
   Nada de lo que sale de aquí se guarda en la base de datos. */
const { CORREOS, MOTIVOS, PIE_LEGAL } = require('./_textos_correo');
const { sitioUrl } = require('./_config');

const ESQUELETO = `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" content="" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>{{ASUNTO}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light only; supported-color-schemes: light only; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      background-color: #FFE9D1 !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body { mso-line-height-rule: exactly; }
    table, td {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    a { text-decoration: none; }
    #MessageViewBody, #MessageWebViewDiv, .body, .email-bg {
      width: 100% !important;
      min-width: 100% !important;
      background-color: #FFE9D1 !important;
    }
    /* Sin apilar la firma. En móvil: logo 48px, texto 11px, nowrap. En escritorio se agranda el logo y el texto si el cliente lee media queries. */
    @media only screen and (max-width: 620px) {
      .email-card { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
      .sig-table { width: 100% !important; max-width: 100% !important; }
    }
    @media only screen and (min-width: 621px) {
      .email-outer { padding: 38px 24px !important; }
      .email-inner { padding: 46px 58px !important; }
      .sig-logo { width: 120px !important; max-width: 120px !important; padding: 0 16px 0 0 !important; }
      .sig-logo img { width: 120px !important; height: auto !important; max-width: 120px !important; }
      .sig-copy { padding: 0 0 0 16px !important; }
      .sig-name { font-size: 15px !important; }
      .sig-claim, .sig-line { font-size: 13px !important; }
    }
  </style>
</head>
<body class="body" bgcolor="#FFE9D1" width="100%" style="margin:0; padding:0; width:100%; min-width:100%; height:100%; min-height:100%; background-color:#FFE9D1; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">{{PREHEADER}}</div>
  <!-- Gmail iOS no aplica el bgcolor del body. El fondo va en este div, en el center y en la tabla 100%. -->
  <div class="email-bg" style="width:100%; min-width:100%; margin:0; padding:0; background-color:#FFE9D1; min-height:100%;">
  <center class="email-bg" style="width:100%; min-width:100%; margin:0; padding:0; background-color:#FFE9D1;">
  <table role="presentation" class="email-wrap" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#FFE9D1" style="width:100%; min-width:100%; background-color:#FFE9D1; border-collapse:collapse; border-spacing:0; margin:0; padding:0; mso-table-lspace:0pt; mso-table-rspace:0pt;">
    <tr>
      <td class="email-outer" align="center" valign="top" bgcolor="#FFE9D1" width="100%" style="padding:16px 10px; margin:0; background-color:#FFE9D1; width:100%;">
        <!--[if mso]>
        <table role="presentation" width="800" border="0" cellpadding="0" cellspacing="0" align="center" bgcolor="#FFFFFF"><tr><td>
        <![endif]-->
        <table role="presentation" class="email-card" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width:100%; max-width:800px; background-color:#FFFFFF; border-collapse:collapse; border-spacing:0; border-radius:6px; overflow:hidden;">
          <tr>
            <td class="email-inner" align="left" valign="top" style="padding:26px 26px; font-family:'OCR B Std','OCR-B','OCR B','Courier New',Courier,monospace; font-size:16px; line-height:1.65; color:#2E2B25; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
{{CUERPO}}
<br>
<table role="presentation" class="sig-table" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; width:100%;">
  <tr>
    <td class="sig-logo" valign="middle" width="48" style="width:48px; max-width:48px; padding:0 4px 0 0; vertical-align:middle;">
      <a href="https://www.bykirco.com" target="_blank" style="display:block; text-decoration:none;">
        <img src="https://www.bykirco.com/assets/email/logo_bykirco.png" width="48" height="36" alt="by_kirco" style="display:block; border:0; width:48px; height:auto; max-width:48px;" />
      </a>
    </td>
    <td class="sig-rule" valign="middle" width="1" style="width:1px; border-left:1.5px solid #DDDDDD; padding:0; font-size:0; line-height:0;">&nbsp;</td>
    <td class="sig-copy" valign="middle" style="padding:0 0 0 4px; vertical-align:middle;">
        <p class="sig-name" style="margin:0 0 1px 0; padding:0; font-family:'Avenir','Avenir Next','Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:700; color:#D07F1F; line-height:1.3; white-space:nowrap;">KIRCO</p>
        <p class="sig-claim" style="margin:0 0 6px 0; padding:0; font-family:'OCR B Std','OCR-B','Courier New',Courier,monospace; font-size:11px; font-weight:400; color:#6F9C3E; line-height:1.4; white-space:nowrap;">Escribo para ti sin conocerte</p>
        <p class="sig-line" style="margin:0 0 2px 0; padding:0; font-family:'OCR B Std','OCR-B','Courier New',Courier,monospace; font-size:11px; font-weight:400; line-height:1.4; white-space:nowrap;">
          <a href="mailto:by.kirco@gmail.com" style="color:#FFAA4D; text-decoration:none;">by.kirco@gmail.com</a>
        </p>
        <p class="sig-line" style="margin:0 0 8px 0; padding:0; font-family:'OCR B Std','OCR-B','Courier New',Courier,monospace; font-size:11px; font-weight:400; line-height:1.4; white-space:nowrap;">
          <a href="https://www.bykirco.com" target="_blank" style="color:#FFAA4D; text-decoration:none;">www.bykirco.com</a>
        </p>
        <p class="sig-line" style="margin:0; padding:0; font-family:'OCR B Std','OCR-B','Courier New',Courier,monospace; font-size:11px; font-weight:400; line-height:1.4; white-space:nowrap;">
          <a href="https://www.instagram.com/by_kirco/" target="_blank" style="color:#1a0dab; text-decoration:none;">Instagram</a> | <a href="https://www.tiktok.com/@by_kirco" target="_blank" style="color:#1a0dab; text-decoration:none;">TikTok</a>
        </p>
    </td>
  </tr>
</table>
{{TRAS_FIRMA}}
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
        {{PIE}}
      </td>
    </tr>
  </table>
  </center>
  </div>
</body>
</html>
`;

const P = 'margin:0 0 24px 0;';

function escapa(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function rellena(texto, vars, html) {
  return String(texto).replace(/\{([a-z_]+)\}/g, (m, k) => {
    if (!(k in vars)) return m;
    const v = vars[k] == null ? '' : String(vars[k]);
    if (!html) return v;
    if (/^enlace_/.test(k)) return '<a href="' + escapa(v) + '" target="_blank" style="color:#D07F1F; text-decoration:underline; word-break:break-all;">' + escapa(v) + '</a>';
    return escapa(v);
  });
}

function motivoTexto(motivo) {
  if (!motivo) return '';
  return MOTIVOS[motivo] || String(motivo);
}

/* datos: { seudonimo, token, motivo, aprobada_entregada, nota, seudonimo_nota } */
function construir(tipo, datos) {
  const def = CORREOS[tipo];
  if (!def) throw new Error('Tipo de correo desconocido: ' + tipo);
  const base = sitioUrl();
  const vars = {
    seudonimo: datos.seudonimo || '',
    enlace_carta: datos.token ? base + '/navidad/abrir.html?t=' + encodeURIComponent(datos.token) : '',
    enlace_navidad: base + '/navidad/',
    enlace_privacidad: base + '/navidad/legal.html',
    motivo: motivoTexto(datos.motivo),
    nota: datos.nota || '',
    seudonimo_nota: datos.seudonimo_nota || ''
  };

  const html = [];
  const texto = [];
  def.parrafos.forEach((p, i) => {
    if (typeof p === 'string') {
      const t = rellena(p, vars, false).trim();
      html.push('<p style="' + P + '">' + rellena(p, vars, true).trim() + '</p>');
      texto.push(t);
    } else if (p.si) {
      if (!datos[p.si]) return;
      html.push('<p style="' + P + '">' + rellena(p.texto, vars, true) + '</p>');
      texto.push(rellena(p.texto, vars, false));
    } else if (p.boton) {
      const url = rellena(p.enlace, vars, false);
      html.push('<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr><td bgcolor="#FFAA4D" style="border-radius:999px; background-color:#FFAA4D;">' +
        '<a href="' + escapa(url) + '" target="_blank" style="display:inline-block; padding:14px 28px; font-family:\'OCR B Std\',\'OCR-B\',\'Courier New\',Courier,monospace; font-size:16px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:999px;">' + escapa(p.boton) + '</a></td></tr></table>');
      texto.push(p.boton + ': ' + url);
    } else if (p.pequeno) {
      html.push('<p style="margin:0 0 24px 0; font-size:12px; line-height:1.5; color:#6B6457;">' + rellena(p.pequeno, vars, true) + '</p>');
      // En texto plano el botón ya lleva la URL; no repetir la línea de «Si el botón no funciona…».
    } else if (p.cita) {
      html.push('<p style="margin:0 0 4px 0; padding:0 0 0 14px; border-left:3px solid #FFAA4D; white-space:pre-wrap;">' + rellena(p.cita, vars, true) + '</p>' +
        '<p style="margin:0 0 24px 0; padding:0 0 0 14px;">' + rellena(p.firma, vars, true) + '</p>');
      texto.push(rellena(p.cita, vars, false) + '\n' + rellena(p.firma, vars, false));
    }
  });

  const trasFirma = def.tras_firma
    ? '<p style="margin:16px 0 0 0; font-size:13px;">' + rellena(def.tras_firma, vars, true) + '</p>'
    : '';
  const pie = '<p style="margin:14px auto 0 auto; max-width:800px; font-family:\'OCR B Std\',\'OCR-B\',\'Courier New\',Courier,monospace; font-size:11px; line-height:1.5; color:#6B6457; text-align:center;">' +
    rellena(PIE_LEGAL, vars, true) + '</p>';

  const htmlFinal = ESQUELETO
    .replace('{{ASUNTO}}', escapa(def.asunto))
    .replace('{{PREHEADER}}', escapa(def.preheader))
    .replace('{{CUERPO}}', html.join('\n'))
    .replace('{{TRAS_FIRMA}}', trasFirma)
    .replace('{{PIE}}', pie);

  const textoFinal = texto.join('\n\n') + '\n\nKirco\nEscribo para ti sin conocerte' +
    (def.tras_firma ? '\n' + rellena(def.tras_firma, vars, false) : '') +
    '\n\n--\n' + rellena(PIE_LEGAL, vars, false) + '\n';

  return { asunto: def.asunto, preheader: def.preheader, html: htmlFinal, texto: textoFinal };
}

module.exports = { construir, escapa };
