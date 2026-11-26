/* by_kirco · Navidad — TEXTOS DE LOS CORREOS (único archivo que hay que tocar para cambiarlos).
   Versión FINAL de Ryan - CW, 26 nov 2026 (entrega/navidad-copy-correos-yo.md), en «yo»; el pie
   legal en «nosotros» (pendiente de validar por Oscar - AL).
   Variables (se sustituyen solas, ya escapadas para HTML):
     {seudonimo}       seudónimo de quien recibe el correo
     {enlace_carta}    enlace privado /navidad/abrir.html?t=TOKEN (solo en «entrega»)
     {enlace_navidad}  portada de /navidad
     {enlace_privacidad} /navidad/legal.html
     {motivo}          línea del motivo de rechazo (MOTIVOS, abajo, o texto libre M4)
     {nota}            texto de la nota de agradecimiento (solo en «nota»)
     {seudonimo_nota}  seudónimo de quien dejó la nota (solo en «nota»)
   Párrafo condicional: un objeto { si: 'aprobada_entregada', texto } solo sale si su carta se aprobó
   y se ha entregado. La firma («Kirco / Escribo para ti sin conocerte.») la pone la plantilla.
   NUNCA metas aquí el texto de una carta ni datos de otra persona. */

const PIE_LEGAL = 'Recibes este correo porque has escrito una carta en by_kirco. Cómo cuidamos tus datos: {enlace_privacidad}';

const MOTIVOS = {
  M1: 'Lleva datos que podrían dar pistas sobre ti o sobre otra persona, y en estas cartas eso no puede viajar.',
  M2: 'Hay algo en ella que podría doler a quien la lea, aunque no fuera esa tu intención.',
  M3: 'Menciona algo que se parece a una promoción, y estas cartas son solo de una persona a otra.'
  // M4: texto libre que escribe Sara en el panel (una frase, en «nosotros», sin juicio).
};

const CORREOS = {
  acuse: {
    asunto: 'Tu carta ya va de camino',
    preheader: 'Y el 25 te llega una a ti.',
    parrafos: [
      'Hola, {seudonimo}:',
      'Tu carta ya va de camino. Gracias por sentarte a escribirla.',
      'Antes de que salga, una persona del equipo la lee, como hacemos con todas. Cuando esté lista, te vuelvo a escribir.',
      'Y alguien que no conoces te escribirá a ti. Te llegará aquí, a este correo, el 25 de diciembre a las 00:00.',
      'Nadie ve tu correo. Quien lea tu carta solo verá tu seudónimo: {seudonimo}.',
      'Si algo no está bien, escríbeme a by.kirco@gmail.com.'
    ]
  },
  aprobada: {
    asunto: 'Tu carta ya está lista',
    preheader: 'La guardo hasta el 25.',
    parrafos: [
      'Hola, {seudonimo}:',
      'Ya hemos leído tu carta y está lista para salir.',
      'La guardo hasta el 25 de diciembre. Esa noche, a las 00:00, le llegará a alguien que no conoces, firmada con tu seudónimo.',
      // Línea OPCIONAL de Ryan (DUDA 3, sin decidir por Sara): 'Desde hoy, quien escriba después de ti puede elegirte para escribirte a ti.'
      'Esa misma noche te llega la tuya, a este correo.'
    ]
  },
  rechazada: {
    asunto: 'Sobre tu carta',
    preheader: 'El 25 te llega una carta igual.',
    parrafos: [
      'Hola, {seudonimo}:',
      'Hemos leído tu carta y esta vez no podemos enviarla. {motivo}',
      'No te quedas sin la tuya. El 25 de diciembre, a las 00:00, te llega una carta a este correo, como a todos los que han escrito.',
      // Párrafo OPCIONAL de Ryan (DUDA 4, sin decidir por Sara): 'Si quieres, puedes escribir otra hasta el 23 de diciembre a las 23:59: {enlace_navidad}'
      'Gracias por sentarte a escribir.'
    ]
  },
  entrega: {
    asunto: 'Te ha llegado una carta',
    preheader: 'Alguien ha pensado en ti.',
    parrafos: [
      'Hola, {seudonimo}:',
      'Ya es 25. Alguien que no conoces te ha escrito una carta, y la tienes aquí:',
      { boton: 'Abrir mi carta', enlace: '{enlace_carta}' },
      { pequeno: 'Si el botón no funciona, copia este enlace en tu navegador: {enlace_carta}' },
      'Ábrela cuando te apetezca, con calma.',
      { si: 'aprobada_entregada', texto: 'Y la tuya también ha llegado esta noche a alguien.' }
    ]
  },
  nota: {
    asunto: 'Alguien te ha dejado una nota',
    preheader: 'Quien recibió tu carta te ha escrito unas líneas.',
    parrafos: [
      'Hola, {seudonimo}:',
      'La persona que recibió tu carta la ha leído y te ha dejado unas líneas. Te las paso tal cual me han llegado:',
      { cita: '«{nota}»', firma: '— {seudonimo_nota}' },
      'No hace falta que contestes. Solo quería que lo supieras.'
    ],
    tras_firma: '{enlace_navidad}'
  }
};

module.exports = { CORREOS, MOTIVOS, PIE_LEGAL };
