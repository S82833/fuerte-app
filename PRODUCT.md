# Fuerte en el VPS

## PWA publicada, 09/11/2026

Publicada con autorización explícita de Simon en https://fuerte.signalvise.com.
Rama `codex/fuerte-pwa`, cambio funcional `50e509c`, PR 5.
El producto incluye manifiesto propio, iconos de 192 y 512 px, icono adaptable,
icono Apple y apertura independiente del navegador. Chrome ofrece el botón
«Instalar Fuerte» cuando el navegador habilita la instalación; las instrucciones
para iPhone indican Safari, Compartir y Añadir a pantalla de inicio. La misma
versión sirve ambos dispositivos. El aviso se oculta cuando ya está instalada.

El worker `/fuerte-sw.js` guarda únicamente recursos públicos enumerados por el
build. No intercepta API, mutaciones ni otros orígenes. Al abrir sin conexión
muestra una pantalla pública de ayuda; no ofrece historial privado ni guardado
offline. La actualización espera el cierre de pestañas y no recarga formularios.
Los recursos con nombre hash tienen caché HTTP; HTML, manifiesto y worker se
revalidan y la API mantiene `no-store`. El logo del producto pasa de 688220 a
5960 bytes, conservando el original de la demo.

Comandos: `npm run build:product`, después `npm run test:pwa` y
`node scripts/product-check.mjs`. Las cinco verificaciones de PWA comprueban
primero una mutación que debe fallar y después el código original. La prueba
de navegador aislada comprobó cero errores de instalabilidad Chrome, ausencia
de datos privados en caché, fallback offline, controles de instalación y ciclo
de actualización con conservación de un formulario abierto. No sustituye una
prueba física de instalación en iPhone y Android.

Verificación pública posterior: HTTPS, manifiesto y MIME, worker idéntico al
paquete, icono, acceso del cuidador con sus perfiles conservados, cierre de sesión,
cero errores de instalabilidad Chrome y pantalla offline. El servicio app quedó
healthy y mantuvo el volumen `fuerte_fuerte_data`. Respaldo de archivos e imagen
anterior en `.releases/pwa-20261109T203928Z` e imagen
`fuerte-app:before-pwa-20261109T203928Z`.

Esta ampliación no implementa suscripciones push ni recordatorios programados.
Tampoco renueva la autenticación de Codex del chat, diagnosticada por separado.

## Revisión de la interfaz del cuidador, 21/09/2026

Las cinco mejoras de la tabla de IHC están conectadas a los datos reales:
confirmación final de dosis con niño y fecha, botón visible y editor de pauta,
identificación separada de cuidador y perfil infantil, consentimiento de IA en
lenguaje claro y consulta del historial antes de abrir su formulario de captura.
El historial permite filtrar los registros cargados y conserva la paginación.
Las dificultades siguen disponibles desde Agregar registro; antes de registrar la
dosis, Tuve una dificultad abre directamente ese tipo de registro.

El estado de dosis consulta la semana completa para no depender de las primeras
treinta entradas. Al cambiar de perfil se bloquea el contenido hasta cargar sus
datos, se limpia el aviso anterior y se reinicia el consentimiento. La explicación
incluye fecha de nacimiento, pauta, registros, resúmenes, conversación y seguimiento
clínico, de acuerdo con el contexto que ya recibe el servicio de IA.

Cambio de frontend, sin migraciones ni modificaciones al backend, al servicio de
IA, al panel clínico o a la demo de GitHub Pages. Validación: TypeScript, Oxlint,
build Vite, product-check y clinical-check; recorrido de navegador con base local
en memoria para dosis, check semanal, pauta, registro, filtros y cambio de perfil.
Las verificaciones funcionales no son sesiones académicas con participantes.

El despliegue conserva una imagen `fuerte-app:before-caregiver-v3-*` y los estáticos
anteriores en `.releases/caregiver-v3-*/dist-product`. Para revertir, etiquetar la
imagen anterior como `fuerte-app:latest` y recrear únicamente `app` con
`docker compose -f compose.product.yml up -d --no-deps --no-build app`.
Nunca eliminar volúmenes para restaurar la interfaz.

Primera versión funcional publicada el 21/09/2026 en https://fuerte.signalvise.com.
La demo de GitHub Pages continúa independiente. El avance académico actual de IHC
solo comprende introducción, objetivo y justificación.

## Operación

- Host: alias SSH `ovh`. Directorio `/home/ubuntu/fuerte-app`.
- `docker compose -f compose.product.yml up -d --build` desde ese directorio.
- Compilar antes con `npx vite build --config vite.product.config.ts` y subir `dist-product`.
- Node 24, archivos estáticos y SQLite, sin SSR ni base de datos adicional como servicio.
- App: 127.0.0.1:3500, límite 256 MiB / 0.5 CPU. Codex: solo red Docker, 512 MiB / 0.75 CPU.
- Volumen de datos `fuerte_fuerte_data`; credenciales separadas en `fuerte_codex_auth`.
- Nginx: únicamente `/etc/nginx/sites-available/fuerte`, con enlace en sites-enabled.
- Certificado Let's Encrypt con renovación automática. ACME: `/var/www/fuerte-acme`.
- DNS A `fuerte.signalvise.com` apunta a 15.204.93.144, DNS only, TTL 300.
  Se añadió únicamente ese registro. Los otros once registros de Signalvise no se modificaron.
- No ejecutar `docker compose down -v`: eliminaría los datos.

## Contrato HTTP

JSON bajo `/api/v1`. Errores `{error:{message}}`, HTTP 401/403/404/409/422/429/503.
Todas las respuestas llevan `Cache-Control: no-store`. Mutaciones requieren Origin
exacto y Content-Type JSON. Sesiones aleatorias, almacenadas como SHA-256, cookies
HttpOnly/Secure/SameSite Strict de siete días. Contraseñas derivadas con scrypt y sal aleatoria.

| Ruta | Método | Función |
| --- | --- | --- |
| /signup, /login | POST | Crear cuenta / iniciar sesión |
| /me | GET | Identidad de la sesión |
| /logout | POST | Revocar sesión |
| /patients | GET, POST | Hasta diez perfiles propios |
| /patients/:id | PATCH | Actualizar pauta transcrita del profesional, con version |
| /patients/:id/records | GET, POST | Historial, páginas de 30 y cursor before; escritura con Idempotency-Key |
| /patients/:id/chat | GET, POST | Últimos 30 mensajes / respuesta contextual con consentimiento explícito |

Los tipos de registros son dose, difficulty, note y appointment. No se calcula ni
modifica tratamiento automáticamente. El servidor verifica pertenencia antes de consultar
historial o construir el contexto del chat; ignora cualquier contexto aportado por el cliente.

## Codex headless

Codex CLI 0.155.1 con autenticación ChatGPT en volumen privado, sin API key.
La autenticación se inicializó por SSH desde la cuenta local ya autenticada; nunca
se imprimió su contenido. No copiar credenciales al repositorio, backups académicos o notas.
Renovar mediante el flujo oficial de `codex login` cuando corresponda.

Cada petición inicia `codex exec --ephemeral --json`, sin reutilizar una tarea anterior.
Shell, unified_exec, apply_patch y búsqueda web desactivados; sandbox de solo lectura.
El contenedor AI no monta la base, otros proyectos, el socket Docker ni archivos del host.
Solo una consulta simultánea, 90 segundos máximos y diez peticiones por usuario/hora.
El proceso termina después de responder, sin mantener un modelo en RAM.

Contexto: fecha de nacimiento, pauta registrada, últimas cien entradas, conteos del historial
y últimos ocho mensajes. No se envían correo, nombre de cuenta ni nombre del perfil.
Los campos libres pueden contener información personal: se solicita consentimiento antes de enviarlos.
Si hay más de cien entradas el modelo recibe una marca explícita de contexto parcial.
La conversación se conserva en SQLite, no como sesión persistente de Codex.
La disponibilidad técnica de autenticación no equivale a cuota garantizada: límites y
renovación dependen de la suscripción. No hay promesa de servicio ilimitado.

Referencias oficiales consultadas:
- https://learn.chatgpt.com/docs/non-interactive-mode
- https://learn.chatgpt.com/docs/auth

## Validación y límites de esta primera versión

`node scripts/product-check.mjs`: autenticación, aislamiento lectura/escritura/chat,
CSRF, reintentos, versión, consentimiento, contexto, paginación y cierre de sesión.
Se rompió la consulta de pertenencia deliberadamente: prueba RED; restaurada: GREEN.
TypeScript, Oxlint y build de producción pasaron. Verificación visual en navegador real.
`scripts/live-check.mjs` verificó HTTPS, cuenta, perfil, dosis, respuesta REAL de Codex,
conversación persistida y logout, exclusivamente con datos ficticios.
La cuenta técnica tiene correo aleatorio @example.test; no es una cuenta compartida de demo.

Consumo medido tras la prueba: app 57.56 MiB y AI 19.69 MiB en reposo.
USIL respondió HTTP 307 hacia login e IAA HTTP 200. Nginx validó su configuración.

Esta primera versión aún no ofrece recuperación de contraseña por correo, verificación
de correo, avisos programados, carga de documentos, exportación
ni eliminación desde la interfaz. No tiene validación clínica. Las respuestas pueden
equivocarse y no deben determinar diagnósticos o cambios de dosis.
El campo de pauta guarda la indicación declarada por el cuidador, no una prescripción verificada.
La búsqueda detallada de registros más antiguos desde el chat requiere una futura ampliación;
ya pueden consultarse mediante la paginación del historial.

Antes de abrirlo a una población clínica: revisar consentimiento y manejo de datos con
el responsable, recuperación y bajas de cuentas, backup/restauración, validación clínica,
y condiciones de uso del proveedor para usuarios externos a la cuenta de suscripción.

## Revisión de seguridad del alcance publicado

Se revisaron las entradas HTTP, consultas SQLite y ejecución headless. SQL parametrizado;
no hay URLs de usuario que se ejecuten, comandos interpolados ni HTML generado por la IA.
La interfaz presenta respuestas como texto React. Los errores no devuelven trazas internas.
Se verificó que otra cuenta recibe 404 en lectura, escritura y chat del perfil ajeno.
El registro de auditoría conserva actor, operación e identificador, sin cuerpos clínicos.
No existe endpoint público del proceso Codex ni acceso directo público a SQLite.

Límites conocidos: protección de volumen mediante permisos, sin cifrado independiente
de SQLite; el límite de login actualmente usa la dirección del proxy y puede afectar
a varias personas a la vez. El registro público carece de verificación de correo.
No presentar esta versión como lista para operación clínica a escala.

## Ampliación de centros y personal de salud, 21/09/2026

Publicada con las tablas adicionales platform_admins, clinics, staff_memberships,
enrollments y clinical_events. Antes se ensayó el esquema dentro de BEGIN IMMEDIATE
y ROLLBACK: 1 ms, lista de tablas idéntica tras la reversión, integrity_check=ok.
Backup previo: `/data/backup-before-clinics-1790020411566.sqlite`, con permisos privados.
El propietario confirmó que creó su cuenta y se le asignó superadministrador; no se
concede este rol por nombre de correo ni por registrarse primero. No hay alta automática
de superadministradores ni credenciales de demo publicadas.

- Superadministrador: centros, lista global de usuarios y roles de cada centro.
- Administrador de centro: equipo y todos los pacientes del propio centro. Solo el
  superadministrador puede nombrar o cambiar administradores de centros.
- Enfermería: pacientes asignados, historial y notas de seguimiento compartidas con
  el cuidador. Puede programar el siguiente contacto al registrar seguimiento.
- Permisos configurables: read_patients, write_followups, manage_assignments, manage_staff.
  manage_assignments amplía la vista a todos los pacientes del mismo centro.
- Cuidador: solicita vinculación con consentimiento explícito; un administrador la
  acepta y asigna al responsable. El cuidador ve las notas compartidas del equipo.
- El chat también recibe los últimos treinta eventos clínicos compartidos y el próximo
  seguimiento, siempre mediante el perfil que pertenece a la sesión del cuidador.
- Panel con filtros de seguimientos vencidos, dificultades de siete días y ausencia
  de registros de dosis en tres días. Son indicadores administrativos, no diagnósticos.
- La semana va de lunes a domingo, en fecha de Perú, y consulta el historial completo
  de esos días. Una dosis registrada se marca con check; una dificultad, con otra señal.

API adicional: `/workspace`, `/centers`, `/platform/clinics`, `/platform/users`,
`/clinics/:id/overview`, `/clinics/:id/staff`, `/clinics/:id/patients`,
`/clinics/:id/patients/:enrollment/events`, `/patients/:id/care` y `/patients/:id/week`.
Los pacientes y usuarios se paginan de treinta en treinta. Hasta cien centros y cien
miembros de equipo por respuesta en esta versión; no asumir escala ilimitada.
Una enfermera desactivada pierde acceso inmediatamente. Toda autorización se vuelve a
consultar en el servidor. No se comparten conversaciones privadas de chat con el personal.

Validación: product-check y clinical-check pasaron. Una mutación que quitó el filtro de
enfermera asignada fue detectada (RED) y la restauración pasó (GREEN). Probados también
consentimiento, denegación entre centros, permisos, revocación, reintentos y semana con
más de cuarenta entradas. UI validada con datos ficticios en servidor local: panel global,
centro, lista, ficha, registro compartido y calendario semanal. La prueba local no se desplegó.
Recursos medidos de la ampliación en reposo: app 17.75 MiB + AI 19.8 MiB, límites sin cambios.

## Landing, tutoriales y páginas legales, 09/11/2026

La raíz `/` sirve la landing pública; `/login` abre el acceso y `/app` la aplicación.
La sesión actualiza la ruta entre `/login` y `/app` sin cargar otro perfil. Los accesos
antiguos de una PWA instalada que abrían `/` se envían a `/app`. Se conserva el `id: /`
y el alcance del manifiesto; su inicio y el botón offline apuntan a `/app`.
Las versiones académicas `/landing/v1/` y `/landing/v2/` se conservan.

La landing incluye ocho FAQ y cuatro grabaciones reales de la vista del cuidador:
recorrido completo 100.288 s, primeros pasos 36.261 s, dosis e historial 38.661 s y
acompañamiento 25.429 s. Video vertical 720 × 1558, H264/AAC, voz femenina Microsoft
`es-PE-CamilaNeural`, subtítulos WebVTT, carteles y transcripción. Los datos son
ficticios y la contraseña se introdujo fuera de la grabación. No se graba una respuesta
inventada de IA: el video y el FAQ explican que el chat está sin conexión. Tampoco se
prometen recordatorios push. La reproducción no es automática y usa `preload=none`.

Los MP4 se transmiten con streams y solicitudes de bytes: 206, Content-Range, HEAD,
416 para rangos inválidos y cierre al desconectarse. No se carga el archivo completo
en memoria por solicitud. Las respuestas de la API siguen siendo privadas y no-store.

`/terminos` y `/privacidad` son documentos públicos en español, enlazados desde la
landing, acceso, registro y vista del cuidador. Describen las funciones y límites
reales del prototipo, autorización separada de IA, contexto enviado, vinculación con
centros, cookies, conservación y ausencia de exportación/borrado autónomo. Simon indicó
que todo es de prueba y que no se publique su nombre: responsable presentado como equipo
del proyecto y correo reservado `privacidad@fuerte.example`, expresamente sin recepción.
No presentar esos documentos como condiciones completas para operación con pacientes reales.
Referencias oficiales: Ley 29733 y DS 016-2024-JUS en Congreso y ANPD.

Validación local: build de producto, TypeScript, Oxlint, product-check; test:landing
5/5 RED con mutaciones y GREEN; test:pwa 5/5 RED y GREEN. Navegador con base aislada:
10 comprobaciones, video con reproducción y búsqueda, subtítulos, cuatro anchos sin
horizontal, FAQ por teclado, documentos legales móviles, sesión y cierre, compatibilidad
con inicio anterior de PWA y Chrome CDP sin errores de instalación. No instalación física
en Android/iPhone. Revisión independiente de rutas/streaming/PWA sin hallazgos P1/P2.

## Recuperación del chat y actualización puntual de videos, 09/11/2026

Autenticación ChatGPT de Codex renovada mediante device code oficial en el contenedor AI.
Se comprobó una respuesta real con datos ficticios, HTTP 200, y health authenticated=true.
Otra consulta desde la interfaz móvil del cuidador verificó las dosis y dificultades del
perfil ficticio usado en el tutorial. No se modificó ni se reinició el servicio AI.

Se grabó únicamente el tramo 06 de acompañamiento con la respuesta real. Los segmentos
00 a 05 y 07 conservaron sus SHA256, al igual que los cortos primeros-pasos y dosis-e-historial.
Recorrido nuevo 103.146 s (1:43), acompañamiento 28.288 s, voz Microsoft Camila y subtítulos
sincronizados. Se actualizaron transcripción y póster. Las URLs modificadas usan
?v=chat-20261109 para evitar mostrar el video anterior desde el caché del visitante.

## Soporte al usuario para S13, 09/11/2026

Simon solicitó una demostración académica con datos ficticios y apariencia realista.
Se añadieron /ayuda.html, /foro.html y /reclamaciones.html, enlazadas desde la landing
y la vista del cuidador. Ocho guías buscables con categorías y lectura desplegable;
foro con cinco temas, respuestas, nueva publicación y persistencia en este navegador;
libro con formulario, folio, confirmación y consulta de seguimiento, además de dos
casos de ejemplo FUE-DEMO-001 y FUE-DEMO-002.

Los registros del soporte usan exclusivamente localStorage en la clave
fuerte-soporte-demo. No se envían a un servidor ni hay recepción oficial de reclamos.
El alcance de demostración y los datos ficticios se explican en las interfaces.
No se modificó SQLite, el backend, la autenticación ni el servicio de IA.

Recorrido de navegador: ocho guías y búsqueda/estado vacío; cinco temas, publicación
y respuesta conservadas tras recargar; formulario de reclamación y folio consultable
tras recargar; tres páginas sin desbordamiento a 390 px y sin errores de consola.

## Libro de reclamaciones y tutorial del cuidador, 11/11/2026

Implementación local en `codex/fuerte-reclamos-recorrido`, pendiente de autorización de despliegue. Fuentes, alcance de demostración y pruebas en [docs/reclamos-recorrido.md](docs/reclamos-recorrido.md). Tutorial repetible con Ver tutorial o `/app?tour=1`. Sin cambios de esquema, backend, autenticación de IA ni servicios del VPS.
