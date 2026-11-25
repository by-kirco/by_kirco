# /navidad — «Regala una carta a un desconocido por Navidad»

Landing temporal de la campaña de Navidad, aislada de la web principal: vive entera bajo
`/navidad` (páginas) y `/api/navidad` (backend). No modifica ningún archivo de la raíz del
proyecto salvo `package.json` (nueva dependencia `@supabase/supabase-js`) y `.gitignore`/`.env`
(sin tocar).

## Qué incluye esta primera entrega

Flujo completo de quien participa, conectado a Supabase de verdad:

- `index.html` — Portada con contador en vivo (`GET /api/navidad/estado`).
- `presentate.html` — Paso 1: seudónimo, saludo, destinatario (bolsa o azar), idea.
- `carta.html` — Paso 2: escribir, con filtro de contenido en el navegador.
- `enviar.html` — Paso 3: correo + casilla 18+, guarda la carta de verdad (`POST /api/navidad/carta`).
- `gracias.html` — Confirmación + cuenta atrás al 25/12 00:00 + añadir al calendario.
- `legal.html` — Política de privacidad completa.
- `panel.html` — Panel privado de Sara (contraseña), para aprobar/rechazar cartas. Ver más abajo.

**Deliberadamente fuera de esta entrega** (a petición explícita, para después):

- Reparto automático del 25 de diciembre y la pantalla `/carta/{token}` para abrir la carta recibida.
- Envío de emails transaccionales (Brevo): aprobación, rechazo, entrega, notas de agradecimiento.

El esquema de datos (`supabase/schema.sql`) ya incluye las tablas `cartas` y `notas` completas,
preparadas para cuando se construya esa segunda fase.

## Puesta en marcha

Ya hecho y confirmado en producción (`bykirco.vercel.app/navidad`):

1. Proyecto Supabase activo: `wpxsrzdlmcywynuftxzr`, con `navidad/supabase/schema.sql` aplicado
   (tablas `cartas`/`notas` + índices únicos + el `GRANT` a `service_role`, imprescindible porque
   las tablas se crearon con SQL a mano y no con el editor visual de Supabase).
2. Variables de entorno en Vercel (Project Settings → Environment Variables, nunca en el repo):
   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (formato nuevo `sb_secret_...`).
3. El repositorio conectado a Vercel para producción es `by-kirco/by_kirco` (rama `master`);
   despliega solo en cada push a esa rama.

### Panel de Sara (`/navidad/panel.html`)

Protegido con una contraseña simple (sin Supabase Auth ni magic link, para no depender de
enviar correos). Hacen falta dos variables de entorno más en Vercel:

- `PANEL_PASSWORD` — la contraseña para entrar. Ponla tú misma, algo que solo tú sepas.
- `PANEL_SESSION_SECRET` — una cadena larga y aleatoria cualquiera (no es una contraseña que
  escribas, solo sirve para firmar la sesión). Por ejemplo, genera una en
  `https://www.uuidgenerator.net/` o similar y pégala tal cual.

La sesión dura 12 horas y se guarda en una cookie firmada (HttpOnly, no se puede leer desde
JavaScript ni falsificar sin conocer `PANEL_SESSION_SECRET`). No hay límite de intentos de
contraseña (aceptable para una herramienta interna temporal, pero si se comparte el enlace
conviene usar una contraseña robusta).

El panel no está enlazado desde ninguna página pública — solo se llega escribiendo la URL
directamente. "Cerrar las cartas ahora" (cierre manual anticipado) se ve en el diseño pero no
está construido todavía: requeriría guardar un estado global de "cerrado" en algún sitio
(hoy el cierre es automático por fecha o por las 300 cartas).

Si se recrea el proyecto de Supabase alguna vez, no olvidar el `GRANT` del final de
`schema.sql` — sin él, el servidor recibe `permission denied for table cartas` aunque la URL
y la clave sean correctas.

## Pruebas ya hechas

- Sintaxis y lógica de las 4 funciones serverless (`node --check` + pruebas con un cliente
  Supabase simulado): validaciones de plazo, límite de 300, correo inválido, texto corto, filtro
  de contenido en servidor, errores de concurrencia (correo duplicado / destino ya elegido).
- Flujo completo en navegador (Playwright) de principio a fin: Preséntate → Carta → Enviar,
  incluido el filtro de contenido bloqueando y desbloqueando el botón "Cerrar el sobre", y la
  validación de correo/casilla en Enviar.
- Flujo real en producción, de principio a fin, con una carta guardada en Supabase.

## Pendiente de confirmar con Sara (igual que el resto de "Pendiente" del FLUJO.md)

- La lista de palabras del filtro de contenido (`navidad/js/filtro.js` y
  `api/navidad/_filtro.js`) es una base razonable para insultos/amenazas/discriminación/sexual,
  no exhaustiva. Hay que revisarla y ampliarla antes de lanzar.
- Textos de "Gracias" (ver nota del FLUJO.md sobre "ya está en el buzón" vs "va de camino").
