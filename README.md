# Fuerte

Demo web móvil basada en las cinco pantallas y la guía Terra del archivo Stitch. React + TypeScript, con Vinext/Vite y componentes accesibles de Base UI.

## Iniciar

Requiere Node.js 22.13 o superior.

```sh
npm install
npm run dev
```

Abre la dirección que indique el servidor. La pantalla se adapta al ancho del teléfono y mantiene un ancho de 480 px en escritorio.

## Flujos incluidos

- Inicio: registro de una toma diaria, dificultad e historial semanal con fechas reales.
- Tuve un problema: selección de motivo, orientación general y registro local.
- Retomar con calma: motivo de pausa y consulta de ejemplo.
- Dudas y mitos: preguntas desplegables y enlace a la fuente clínica.
- Personal de salud: cuatro familias ficticias, búsqueda, filtros, notas de visita, entrega de frasco e historial.
- Perfil: explicación de la demo y reinicio confirmado de los datos de ejemplo.

Los datos se guardan solo en localStorage (`fuerte-demo-v1`) en este navegador. No hay autenticación, sincronización entre dispositivos ni envío de mensajes. Los nombres y estados proceden de ejemplos del diseño. No introducir datos reales de salud.

## Compilar y verificar

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

La prueba de dominio valida seis comportamientos y prueba una mutación por cada uno: primero demuestra que la comprobación detecta el fallo y después valida el código original. El lint cubre el código propio, no los componentes sin cambios del generador, que contienen avisos preexistentes.

`npm run build` genera el Worker y sus recursos en `dist/`; `postbuild` crea el inventario de recursos para el modo offline. `npm start` permite servir la compilación mediante Wrangler. El manifiesto PWA permite añadir la app al inicio en navegadores compatibles. El service worker se activa solo en producción, sobre HTTPS o localhost; primero se debe cargar la app con conexión. La interfaz anuncia disponibilidad offline solo después de que el cache esté listo.

## Contenido y límites

Se preservó la identidad visual del ZIP (Literata, Nunito Sans, crema y verde, imágenes y logo). Las fuentes y fotografías se distribuyen localmente. Se reemplazaron instrucciones clínicas categóricas del diseño por orientación general y derivación al personal de salud. Fuente informativa: [Medicines for Children: ferrous sulfate](https://www.medicinesforchildren.org.uk/medicines/ferrous-sulfate-for-iron-deficiency-anaemia/).

Antes de usar con pacientes reales hacen falta revisión clínica, permisos y roles, almacenamiento seguro, protección de datos, autenticación y un diseño de sincronización. Esta versión no calcula dosis ni sustituye atención clínica.

La publicación está pendiente de autorización del propietario. El proyecto de Sites ya está registrado en `.openai/hosting.json`, pero no está publicado.
