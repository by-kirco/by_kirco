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

Segunda fase (rama `navidad-resend`, 26 nov 2026, **sin publicar**): correos con Resend, sorteo,
cartas de reserva, página para abrir la carta (`abrir.html`) y notas de agradecimiento. Ver
«Segunda fase» más abajo.

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

Protegido con Supabase Auth (correo + contraseña reales, con la contraseña guardada cifrada
por Supabase, no por nosotros). Para activarlo:

1. En Supabase → **Authentication → Users** → **Add user**, crea tu usuario con tu correo y una
   contraseña. Marca la opción de confirmarlo automáticamente (según la versión del panel se
   llama "Auto Confirm User" o ya viene confirmado al crearlo desde ahí) — así no hace falta
   mandar ningún email de verificación.
2. En Vercel, añade la variable `SUPABASE_ANON_KEY` con la **Publishable key** del proyecto
   (la misma pantalla "Data API"/"API Keys" donde sacaste `SUPABASE_URL`; es la que empieza por
   `sb_publishable_...`, no la `sb_secret_...` que ya tienes).
3. Entra en `/navidad/panel.html` con ese correo y contraseña.

La sesión usa el access token + refresh token reales de Supabase, guardados en cookies
HttpOnly; se renueva sola mientras el refresh token siga siendo válido (hasta 30 días sin
volver a entrar). El límite de intentos de contraseña y el cifrado de la contraseña los
gestiona Supabase, no este código.

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
- Textos de "Gracias": aplicados los finales de Ryan (26 nov), «Tu carta ya va de camino».


## Segunda fase · correos, sorteo, reservas y abrir la carta (rama `navidad-resend`)

> Sara, 26 nov: «Usamos Resend» · «Todavía no añadas los registros DNS» · «Sí, todos reciben carta
> con una reserva» · «Textos cálidos en yo, lo legal en nosotros». Nada de esto está publicado ni
> aplicado en Supabase. Es CONFIDENCIAL hasta el lanzamiento.

### Qué hay

| Pieza | Archivo |
|---|---|
| Migración SQL (NO aplicada) | `supabase/migracion_02_correos_sorteo.sql` |
| Fechas y constantes | `api/navidad/_config.js` |
| Envío con Resend + cola `correos` | `api/navidad/_correo.js` |
| **Textos de los 5 correos (único archivo a tocar)** | `api/navidad/_textos_correo.js` |
| Plantilla HTML (naranja + caja blanca + firma KIRCO) | `api/navidad/_plantilla_correo.js` |
| Núcleo del sorteo (reproducible) | `api/navidad/_sorteo_core.js` |
| Sorteo (panel) | `api/navidad/sorteo.js` |
| Reintento de correos (cron diario / panel) | `api/navidad/correos-pendientes.js` |
| Abrir la carta + nota de agradecimiento | `navidad/abrir.html` + `api/navidad/abrir.js` |
| Reenviar/descartar notas (panel) | `api/navidad/panel-nota.js` |
| Cargar las cartas de reserva | `scripts/navidad/reservas_a_sql.js` |
| Verificar el sorteo | `scripts/navidad/verificar_sorteo.js` |
| Pruebas | `tests/navidad/` (`npm run test:navidad`) |

`.vercelignore` evita que `scripts/`, `tests/` y `navidad/supabase/` se sirvan como estáticos.

### Correos (5)

1. **Acuse** al enviar la carta (`carta.js`). 2. **Aprobada** y 3. **No aprobada** (con motivo
obligatorio M1/M2/M3 o texto libre) cuando Sara decide en el panel (`panel-accion.js`).
4. **Entrega** el 25/12 a las 00:00 (Madrid): se programa en Resend (`scheduled_at`
2026-12-24T23:00:00Z) justo después del sorteo, con el enlace privado
`/navidad/abrir.html?t=TOKEN`. 5. **Nota** de agradecimiento, cuando Sara la reenvía.

- Ningún correo lleva el texto de la carta ni datos de la otra persona (salvo, en el 5.º, la nota y
  el seudónimo de quien la deja, que es su propósito). El cuerpo de los correos no se guarda.
- Sin `RESEND_API_KEY` todo funciona en **modo simulación**: se marca `simulado` y no se llama a Resend.
- Un fallo de correo nunca rompe la respuesta a quien escribe. Lo que no sale queda `pendiente` y lo
  reintenta `/api/navidad/correos-pendientes` (cron diario de Vercel a las 08:00 UTC, en
  `vercel.json`, o el botón «Reintentar correos pendientes» del panel).
- Resend no reintenta los 429 (`daily_quota_exceeded`, `monthly_quota_exceeded`): se quedan pendientes.

### Activar Resend (cuando Sara tenga la cuenta; nada de esto está hecho)

1. Sara crea la cuenta en Resend y añade el dominio `bykirco.com`. **Verificarlo = añadir registros
   DNS** que da Resend: MX y TXT (SPF) en `send.bykirco.com` y el DKIM `resend._domainkey`
   (+ DMARC recomendado). **PENDIENTE del OK de Sara** («Todavía no añadas los registros DNS»).
2. En Vercel → Environment Variables (nunca en el repo ni en un chat):
   - `RESEND_API_KEY` (la crea Sara en Resend, permiso «Sending access»).
   - `CORREO_REMITENTE` (opcional; por defecto `by_kirco <cartas@bykirco.com>`).
   - `CORREO_RESPONDER_A` (opcional, p. ej. `by.kirco@gmail.com`).
   - `CRON_SECRET` (una cadena larga aleatoria; Vercel la manda sola al cron).
   - `SITIO_URL` (opcional; por defecto `https://www.bykirco.com`).
3. Aplicar la migración 02 en Supabase (abajo) y cargar las reservas.

### Límites del plan gratis de Resend (comprobar antes del 20 dic)

- **100 correos al día** (día UTC) y **3.000 al mes**; 1 dominio.
- Volumen previsto con 300 cartas: ~1.200-1.500 correos en diciembre (cabe en el mes).
- **El problema es el 25**: todas las entregas salen a la vez. Con más de ~90 personas no caben en
  los 100 diarios: el resto se queda pendiente y sale con el cron del día siguiente (25 a las 09:00
  Madrid) o los siguientes. **Decisión pendiente de Sara**: Resend Pro (20 $/mes) solo en diciembre
  y cancelar en enero. Los acuses y avisos diarios también cuentan para los 100/día.

### Sorteo

Botón «Hacer el sorteo» del panel, solo después del cierre (23/12 23:59). Una sola vez: si ya se hizo,
devuelve el mismo. Todo se guarda en una transacción (`navidad_registrar_sorteo`).

- Reciben carta **todas las personas que escribieron**, también si se rechazó su carta o quedó sin
  revisar, **una por correo** (si a alguien le rechazaron una y le aprobaron otra, recibe una).
- Se reparten solo cartas aprobadas. Las dirigidas van a su destino; las «al azar», entre las personas
  aprobadas que aún no reciben ninguna, sin que nadie reciba la suya y evitando A↔B (con 2 personas es
  inevitable). Quien se queda sin carta de persona recibe una **reserva**.
- Casos límite, en el comentario de `_sorteo_core.js`.
- Semilla `crypto.randomBytes(32)` + PRNG SHA-256 en contador. Se guardan la semilla, la entrada
  (solo ids, estados y agrupación; sin correos ni textos), el resultado y la huella SHA-256.
- Verificar: exportar la fila de `sorteos` a JSON y `node scripts/navidad/verificar_sorteo.js sorteo.json`.

### Cartas de reserva (las escribe Toby - PNM; **20**, una por temática aprobada)

- Privadas: **nunca en el repo** (Vercel sirve el repo como estático). Van en la tabla `cartas_reserva`.
- Formato que entrega Toby: `[{ "id": "R01", "texto": "…", "tematica": "opcional" }]`. Cuerpo sin
  saludo ni firma, 80-3000 caracteres, neutro de género. El sistema antepone «Querido/Querida/Hola,
  [seudónimo]:» de quien la recibe y firma «Kirco». En `abrir.html` se ve igual que las demás.
- Cargar (tras el OK de Sara): `node scripts/navidad/reservas_a_sql.js reservas.json > reservas.sql`
  y pegar el `.sql` en el SQL Editor de Supabase. Ni el JSON ni el `.sql` se suben (`.gitignore`).
- Se usan primero las que nunca se han usado; si hacen falta más de las cargadas, se reutiliza la
  menos usada (una persona solo recibe una, así que nunca la misma dos veces). Sin ninguna cargada,
  el sorteo no se hace. El panel muestra «necesarias vs cargadas» con aviso.

### Abrir la carta (`abrir.html?t=TOKEN`)

Estados: antes del 25 (cuenta atrás), sobre listo, carta abierta, enlace no válido y error. Funciona
desde el 25/12 00:00 hasta el **24/01/2027** (fecha de borrado de `legal.html`); después, «no válido».
«Guardar mi carta» imprime solo la carta (o PDF). «Avísanos» abre un correo a by.kirco@gmail.com.
La nota de agradecimiento (máx. 300, pasa el filtro) queda `pendiente` en el panel; «Reenviar» manda el
5.º correo a quien escribió. Si la carta era de reserva, la nota es para Kirco y solo se ve en el panel.

### Aplicar la migración (con el OK de Sara, antes de desplegar esta rama)

Supabase → SQL Editor → pegar `supabase/migracion_02_correos_sorteo.sql` → Run. Es idempotente.
Probada en un Postgres en memoria (PGlite) con `tests/navidad/migracion_pglite.mjs`.

### Pendiente antes de lanzar

- Cuenta de Resend + `RESEND_API_KEY` (Sara) · registros DNS (OK de Sara) · migración 02 y reservas
  en Supabase (OK de Sara) · variables en Vercel · decisión del plan Pro de diciembre.
- **Privacidad (Oscar - AL)**: añadir a Resend como encargado del tratamiento en `legal.html`
  («Quién nos ayuda»); revisar que los correos de acuse y aprobada están cubiertos; el pie legal de
  los correos. No se ha tocado `legal.html` por esto.
- Quitar los `noindex` marcados «QUITAR AL LANZAR» (no el de `abrir.html` ni el del panel).
