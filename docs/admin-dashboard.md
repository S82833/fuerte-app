# Dashboard general de Fuerte

Implementado y verificado localmente el 16/11/2026. Pendiente de autorización específica para publicar junto con la actualización del cuidador.

El superadministrador entra al «Dashboard general». Desde cualquier centro puede volver con ese mismo botón; «Resumen del centro» conserva el contexto del establecimiento. Se mantienen la gestión de centros, usuarios, personal y pacientes.

## Datos y significado

`GET /api/v1/platform/overview` requiere sesión y el rol global de superadministrador, comprobado en el servidor. Devuelve únicamente agregados y datos identificativos de centros, sin nombres de pacientes, correos, pautas ni mensajes. Las cifras proceden de SQLite; no se generan ejemplos en producción para llenar el dashboard. Los registros de demostración que ya existen se incluyen.

- Centros registrados y cuentas registradas: todos los registros existentes.
- Personal activo único: personas con membresía activa en al menos un centro activo, contadas una vez globalmente.
- Cuidadores con perfil: cuentas propietarias de al menos un perfil infantil; una cuenta con varios niños cuenta una vez.
- Perfiles: total, seguimiento activo, solicitud pendiente, seguimiento cerrado o sin vinculación. La restricción única por paciente permite que estos estados no se dupliquen.
- Actividad histórica: registros de dosis, dificultades, apuntes, controles del cuidador, eventos del equipo de salud y mensajes del chat de ambos roles.
- Gráfica: registros de dosis y dificultades por fecha registrada, durante 30 días inclusivos hasta hoy en Lima. Se completan días sin actividad con cero. No se calcula adherencia ni se interpreta ausencia de registros como ausencia de tratamiento.
- Tabla de centros: membresías activas y seguimientos por estado. Una persona puede figurar en varios centros, aunque cuenta una vez en el total global. Las membresías históricamente activas de un centro inactivo siguen figurando en su fila; el total global de personal con acceso lo excluye.

La API usa un número fijo de consultas y un límite de 100 centros. No incorpora dependencias, migraciones, trabajos periódicos ni consultas externas. El panel se carga solo en la interfaz clínica y consulta estadísticas al abrirse o al pulsar Actualizar. Los gráficos usan CSS; los datos diarios también están disponibles en una tabla.

## Comprobaciones

- `scripts/platform-stats-check.mjs`: base en memoria, 401 sin sesión, 403 para cuidador, enfermería y administrador de centro, acceso para superadministrador, recuentos distintos, estados, actividad y ausencia de datos personales. Mutar DISTINCT por COUNT produjo un fallo y restaurarlo volvió a pasar.
- `scripts/admin-dashboard-browser-check.mjs`: vacío, datos de prueba persistidos en memoria, navegación directa centro/global, gráficos y etiquetas legibles, límites en 1440, 390 y 320 px, tabla diaria, error/reintento y cero escrituras. La mutación de anchura excesiva falla y se restaura.
- Revisión independiente de autorización y privacidad sin hallazgos bloqueantes; comprobación adicional de medianoche de Lima y ventana inclusiva de 30 días.
- TypeScript, Oxlint, compilación del producto y pruebas existentes de permisos clínicos correctos.

Capturas técnicas: `work/admin-dashboard-20261116/`. No son cifras del servidor; son fixtures de prueba en memoria. La publicación debe incluir los estáticos compilados, `server/clinics.mjs` y el nuevo `server/platform-stats.mjs`, preservando el volumen y los demás servicios.
