# Libro de reclamaciones y recorrido guiado de Fuerte

Estado al 11 de noviembre de 2026: **publicados en https://fuerte.signalvise.com con autorización explícita de Simon**.

## Libro de reclamaciones: demostración académica

El formulario público `/reclamaciones.html` simula una hoja en cuatro pasos: **tipo (reclamo o queja), datos del consumidor, producto o servicio y detalle, revisión**. Pide los campos mínimos descritos por Indecopi, permite volver sin perder lo escrito y genera una copia imprimible o descargable. El folio `FUE-DEMO-AAAA-000001` es correlativo **solo en el navegador**; los dos folios precargados son casos de ejemplo, sin estados reales de trámite.

Los datos ficticios se conservan en `localStorage`, clave `fuerte-soporte-demo`, junto a los datos del foro. No hay envío, recepción, seguimiento por servidor ni plazo de atención iniciado. Fuerte figura como **proyecto académico**: razón social, RUC y dirección del proveedor no están configurados y no se inventaron. Esta página **no es un canal oficial** para presentar reclamaciones. Para habilitar uno real se necesitan datos legales verificados, recepción y numeración persistentes, copia al consumidor, controles de privacidad y respuesta efectiva.

Fuentes oficiales consultadas:

- [Indecopi: Libro de Reclamaciones](https://consumidor.gob.pe/libro-de-reclamaciones/) y [preguntas y respuestas](https://consumidor.gob.pe/wp-content/uploads/2020/07/Preguntas_Respuestas_LR_12.11.2025.pdf): distinción reclamo/queja, datos mínimos, copia imprimible y plazo real de **15 días hábiles no prorrogables**. Ese plazo no corre en esta demo.
- [Movistar: Libro de Reclamaciones](https://www.movistar.com.pe/libro-de-reclamaciones) y [Claro: Libro de Reclamaciones](https://libroreclamaciones.claro.com.pe/WReclamaciones/): presentan primero la elección entre reclamo y queja; separan los trámites propios de telecomunicaciones, que no se copiaron a Fuerte.
- [Claro OLO: formulario](https://www.claro.com.pe/personas/olo/libro-de-reclamaciones/): muestra etapas de datos y detalle, campos de contacto y representante de un consumidor menor de edad. Su pie muestra 30 días; ante esa discrepancia se siguió el plazo vigente indicado por Indecopi.

## Recorrido guiado del cuidador

En la aplicación, `/app?tour=1` solicita abrir el tutorial; el botón **Ver tutorial** permite repetirlo. Se propone automáticamente en la primera visita de cada cuenta en cada navegador, usando una marca local versionada por usuario. Recorre inicio, historial, formulario de registro, pauta y acompañamiento sin guardar una dosis, cambiar la pauta ni enviar mensajes. Si aún no existe un perfil infantil, indica crearlo y retoma el recorrido cuando esté disponible. Publicado el 11/11/2026; el parámetro se conserva al pasar por el login.

## Verificación local

Build de producción, TypeScript y Oxlint correctos. `scripts/tour-check.mjs`: 6 comprobaciones, cada una RED bajo mutación y GREEN con el original. Product-check, PWA y landing sin regresiones. Se comprobó en Chromium de escritorio y formato celular: recorrido de 10 pasos con clics reales, retroceso a puntos reabribles, Omitir/Escape, reinicio manual, primera visita sin perfil, conservación de borrador y cambio de cuenta con workspace demorado. El recorrido dejó cero registros y cero mensajes nuevos en la base de prueba.

El libro se verificó con DNI incompleto, representante requerido, monto inválido, detalle tratado como texto, confirmación obligatoria, regreso sin pérdida, folios 000001 y 000002, descarga y consulta tras recarga. El contenido previo del foro permaneció intacto. La visibilidad de controles ocultos y la selección obligatoria se comprobaron RED bajo mutación y GREEN con el original. Evidencia local en `work/reclamos-recorrido-20261111/`. Las pruebas técnicas no son sesiones académicas con participantes.

## Publicación verificada

Commit funcional `739fc80`, PR 9, publicación autorizada por Simon con «desplieuga». Paquete de nueve archivos estáticos (129 220 bytes), publicado el 11/11/2026 a las 22:41 UTC. La imagen candidata heredó el servidor y runtime anteriores y conservó los assets antiguos. Candidato aislado con base efímera; después se recreó únicamente `app`. Servicio healthy, nueve hashes HTTPS coincidentes, backend y volumen de datos sin cambios, AI y demás contenedores con los mismos identificadores. Navegador público comprobó formulario de cuatro pasos, validación y conservación de /app?tour=1 al pasar por login, sin errores JavaScript.

Respaldo: `/home/ubuntu/fuerte-app/.releases/reclamos-recorrido-20261111T224102Z`, imagen `fuerte-app:before-recorrido-20261111T224102Z`. Imagen nueva: `sha256:29b93128997bb9b5e0c2ba46e5f8d639946ff3a1c03d620961687fc58d3d8ded`. El registro deployment.json contiene las comprobaciones. No hubo migraciones, cambios DNS ni cambios del servicio AI.
