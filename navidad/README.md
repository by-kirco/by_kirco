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

**Deliberadamente fuera de esta entrega** (a petición explícita, para después):

- Panel de revisión de Sara (`Panel.dc.html`). Sin él, ninguna carta pasa a `aprobada`, así que
  la "bolsa" de destinatarios en Preséntate estará vacía hasta que exista — el flujo ya está
  listo para mostrarla en cuanto haya cartas aprobadas.
- Reparto automático del 25 de diciembre y la pantalla `/carta/{token}` para abrir la carta recibida.
- Envío de emails transaccionales (Brevo): aprobación, rechazo, entrega, notas de agradecimiento.

El esquema de datos (`supabase/schema.sql`) ya incluye las tablas `cartas` y `notas` completas,
preparadas para cuando se construya esa segunda fase.

## Puesta en marcha (pendiente, requiere acción de Sara)

1. **Activar el proyecto Supabase.** El proyecto `By_kirco` (`lymmqtwywlqgaajnahjb`) está en pausa
   (plan gratuito). Hay que restaurarlo desde el dashboard de Supabase o pedírmelo de nuevo una
   vez quieras que lo haga yo — la restauración automática quedó bloqueada por el modo seguro de
   esta sesión.
2. **Aplicar el esquema.** Ejecutar `navidad/supabase/schema.sql` en ese proyecto (SQL Editor o
   `apply_migration`).
3. **Variables de entorno en Vercel** (Project Settings → Environment Variables, nunca en el repo):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Desplegar.** El resto del proyecto sigue desplegándose igual: `npx vercel deploy --prod --yes`.
   Al ser funciones serverless nuevas bajo `/api`, Vercel las detecta solas.

## Pruebas ya hechas en esta sesión

- Sintaxis y lógica de las 4 funciones serverless (`node --check` + pruebas con un cliente
  Supabase simulado): validaciones de plazo, límite de 300, correo inválido, texto corto, filtro
  de contenido en servidor, errores de concurrencia (correo duplicado / destino ya elegido).
- Flujo completo en navegador (Playwright) de principio a fin: Preséntate → Carta → Enviar,
  incluido el filtro de contenido bloqueando y desbloqueando el botón "Cerrar el sobre", y la
  validación de correo/casilla en Enviar.
- Sin pruebas reales contra Supabase todavía (el proyecto está pausado) ni contra Vercel (las
  funciones `/api` no existen en un servidor estático local): eso hay que probarlo tras el paso 1-3.

## Pendiente de confirmar con Sara (igual que el resto de "Pendiente" del FLUJO.md)

- La lista de palabras del filtro de contenido (`navidad/js/filtro.js` y
  `api/navidad/_filtro.js`) es una base razonable para insultos/amenazas/discriminación/sexual,
  no exhaustiva. Hay que revisarla y ampliarla antes de lanzar.
- Textos de "Gracias" (ver nota del FLUJO.md sobre "ya está en el buzón" vs "va de camino").
