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
- `panel.html` — Panel privado de Sara (Supabase Auth), para aprobar/rechazar cartas pendientes
  (con motivo obligatorio al rechazar), **reconsiderar una carta ya aprobada y rechazarla** si
  hace falta (siempre que todavía no se haya repartido), y reenviar notas de agradecimiento, con
  email automático en todos los casos. Ver más abajo.
- `abrir.html` — Página para abrir la carta recibida (`/navidad/abrir.html?t={token}`), con sus
  5 estados: antes del 25, carta al llegar, sobre sellado listo para abrir, carta abierta (con
  "Guardar mi carta" en PDF vía imprimir, "Avísanos" y la nota de agradecimiento de verdad) y
  enlace no válido. Lee los datos de `GET /api/navidad/carta-abierta?t=` y manda la nota con
  `POST /api/navidad/nota` (pasa por el mismo filtro de contenido que las cartas).

Emails automáticos (Resend), en voz de Kirco ("yo") salvo el pie legal ("nosotros"):
aprobar, rechazar (con el motivo elegido en el panel), reenvío de nota de agradecimiento, y
"Feliz Navidad, alguien te ha escrito esto para ti" (se dispara con "Repartir ahora", ver abajo).

### Reparto manual, para pruebas (botón "Repartir ahora (prueba)" en el panel)

El panel tiene un botón que empareja las cartas aprobadas sin repartir (respeta los destinos
elegidos a mano, reparte al azar entre el resto, sin que nadie se escriba a sí mismo) y manda ya
el email "Feliz Navidad..." a cada una. En cuanto una carta tiene `recibe_carta_id` asignado,
`/navidad/abrir.html` la muestra al momento — **no hace falta esperar al 25 de diciembre**: la
fecha solo bloquea a quien todavía no tiene nada asignado. Así se puede probar el flujo completo
(email de entrega → abrir la carta → mandar las gracias) cualquier día, con un puñado de cartas
de prueba aprobadas (`POST /api/navidad/panel-repartir`).

**Esto NO es el reparto automático real del 25 de diciembre** (eso sigue sin construirse: haría
falta decidir el reparto de las 100 cartas reales a las 00:00 hora de Madrid, probablemente con
un cron — limitación del plan Hobby de Vercel a tener en cuenta). "Repartir ahora" es un disparador
manual pensado para probar con pocas cartas, no para usarse el día de verdad con el buzón completo.

### Asignar una carta de reserva a mano (botón en cada tarjeta de "Ya aprobadas")

Cuando alguien aprobado se queda sin pareja (por ejemplo, una sola carta aprobada: "Repartir
ahora" exige mínimo 2), Sara puede elegir ella misma, en un desplegable, cuál de las cartas de
reserva sin usar mandarle — no es automático ni al azar. Al confirmar, se marca esa reserva como
usada (`cartas_reserva.usada`), la carta deja de aparecer en "Ya aprobadas" y se manda ya el
email de entrega real. En `/navidad/abrir.html` se ve igual que una carta normal, firmada "Kirco".

### Añadir una carta de reserva como "carta de Kirco" (aside "Fechas y acciones")

Distinto del punto anterior: en vez de dar una reserva a una persona concreta que se ha
quedado sin pareja, esto convierte una carta de reserva en una carta normal y aprobada más,
como si la hubiese escrito `by.kirco@gmail.com` (con un alias `+`, p. ej.
`by.kirco+a1b2c3d4@gmail.com` — Gmail ignora lo que va después del `+` y todo llega al mismo
buzón real). Sirve para rellenar el buzón con cartas de verdad antes de "Repartir ahora",
por ejemplo para poder probar el reparto sin esperar a tener suficientes cartas reales, o para
cuadrar un número impar de participantes.

Como es una carta aprobada más, entra en "Repartir ahora" exactamente igual que cualquier
otra: puede tocarle a alguien como destino, y a su vez recibe una carta real en el sorteo — no
hace falta ningún código especial para que quede equilibrado, es el mismo `emparejaSinAutoenvio`
de siempre. En "Ya aprobadas" se distingue con la etiqueta "· relleno de Kirco" junto al nombre.
No manda ningún email al crearla (no hay nadie real esperando el aviso de "tu carta ya está en
el buzón"). Marca la reserva como usada (`cartas_reserva.usada`), así que no se puede volver a
usar ni aquí ni en el asignar-reserva del punto anterior.

### Bloquear un correo a mano (botón "Bloquear correo" en "Por revisar" y en "Ya aprobadas")

Para spam o incumplimiento repetido de las políticas desde la misma cuenta. Hace lo mismo que
"Rechazar" (se pide un motivo, la carta pasa a `rechazada` y se borra el texto, se manda el
mismo email de rechazo de siempre) y además guarda el correo en `correos_bloqueados`. Mientras
esté ahí, `POST /api/navidad/carta` rechaza cualquier carta nueva desde ese correo con un 403,
antes incluso de llegar a la cola de revisión. La persona no recibe ningún aviso de que,
además de rechazada, ha quedado bloqueada — ve el mismo mensaje que cualquier rechazo normal.

Quitar un bloqueo todavía no tiene botón en el panel: por ahora se borra a mano la fila
correspondiente en `correos_bloqueados` desde el SQL Editor de Supabase.

**Deliberadamente fuera de esta entrega** (a petición explícita, para después):

- El reparto automático de verdad, disparado solo el 25 de diciembre a las 00:00 sin que nadie
  tenga que entrar al panel a darle al botón (ni para emparejar cartas reales entre sí, ni para
  decidir por su cuenta cuándo hace falta una carta de reserva).

El esquema de datos (`supabase/schema.sql`) ya incluye las columnas (`abierta_at`, `motivo`,
`recibe_reserva_id`) y la tabla `cartas_reserva` preparadas para cuando se construya esa fase,
y también la tabla `correos_bloqueados` del bloqueo manual descrito arriba.

## Puesta en marcha

Ya hecho y confirmado en producción (`bykirco.vercel.app/navidad`):

1. Proyecto Supabase activo: `wpxsrzdlmcywynuftxzr`, con `navidad/supabase/schema.sql` aplicado
   (tablas `cartas`/`cartas_reserva`/`notas` + índices únicos + el `GRANT` a `service_role`,
   imprescindible porque las tablas se crearon con SQL a mano y no con el editor visual de Supabase).
   Después, ejecutar una sola vez `navidad/supabase/seed_reserva.sql` para cargar las 20 cartas
   de reserva (ya escritas y aprobadas, firman "Kirco", no cuentan para el límite de 100 ni
   aparecen en la bolsa — son solo un banco para cuando el reparto, fase futura, necesite dar una
   carta a alguien que de otro modo se quedaría sin una). El panel muestra cuántas hay y cuántas
   se han usado en el KPI "Reserva".
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
(hoy el cierre es automático por fecha o por las 100 cartas).

Si se recrea el proyecto de Supabase alguna vez, no olvidar el `GRANT` del final de
`schema.sql` — sin él, el servidor recibe `permission denied for table cartas` aunque la URL
y la clave sean correctas.

## Pruebas ya hechas

- Sintaxis y lógica de las funciones serverless (`node --check` + pruebas con un cliente
  Supabase simulado): validaciones de plazo, límite de 100, correo inválido, texto corto, filtro
  de contenido en servidor, errores de concurrencia (correo duplicado / destino ya elegido),
  `carta-abierta` en sus 4 estados (no encontrada / antes / camino / abierta, con saludo y firma
  correctos) y `nota` (antes del 25, sin carta asignada, guardado correcto, duplicado, filtro).
- Flujo completo en navegador (Playwright) de principio a fin: Preséntate → Carta → Enviar,
  incluido el filtro de contenido bloqueando y desbloqueando el botón "Cerrar el sobre", y la
  validación de correo/casilla en Enviar.
- `abrir.html` en sus 5 estados con la API simulada, incluido abrir el sobre y mandar una nota.
- El selector de motivo del panel al rechazar una carta (obligatorio, se manda en el email).
- Flujo real en producción, de principio a fin, con una carta guardada en Supabase.

## Pendiente de confirmar con Sara (igual que el resto de "Pendiente" del FLUJO.md)

- La lista de palabras del filtro de contenido (`navidad/js/filtro.js` y
  `api/navidad/_filtro.js`) es una base razonable para insultos/amenazas/discriminación/sexual,
  no exhaustiva. Hay que revisarla y ampliarla antes de lanzar.
- Textos de "Gracias" (ver nota del FLUJO.md sobre "ya está en el buzón" vs "va de camino").
