/* by_kirco · Navidad — fechas y constantes compartidas por las funciones de /api/navidad.
   Todas en UTC; entre paréntesis, la hora de Madrid (CET, UTC+1). */
module.exports = {
  EDICION: 2026,
  TOTAL: 300,
  // Cierre del buzón: 23/12/2026 23:59:59 (Madrid). Igual que en carta.js y estado.js.
  PLAZO_UTC: '2026-12-23T22:59:59Z',
  // Entrega y apertura de las cartas: 25/12/2026 00:00 (Madrid).
  APERTURA_UTC: '2026-12-24T23:00:00Z',
  // Último día del enlace privado: 24/01/2027 (Madrid), fecha de borrado de legal.html.
  // Desde el 25/01/2027 00:00 (Madrid) el enlace se trata como «no válido».
  CADUCIDAD_UTC: '2027-01-24T23:00:00Z',
  NOTA_MAX: 300,
  sitioUrl() {
    return String(process.env.SITIO_URL || 'https://www.bykirco.com').replace(/\/+$/, '');
  }
};
