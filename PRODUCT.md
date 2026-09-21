# Fuerte en el VPS

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
de correo, roles clínicos compartidos, avisos programados, carga de documentos, exportación
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
