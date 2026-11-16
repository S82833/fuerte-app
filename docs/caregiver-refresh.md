# Actualización del cuidador y separación de la navegación

Preparado localmente el 16/11/2026. Pendiente de autorización específica para publicar esta versión.

El encabezado del cuidador incorpora «Actualizar información». En pantallas táctiles, un desplazamiento vertical hacia abajo de al menos 110 px, iniciado en el extremo superior de la página, ejecuta la misma lectura. La interfaz muestra cuándo soltar, cuándo está actualizando y si hubo un error. La actualización consulta perfiles, historial, semana, conversación y seguimiento del centro, conservando los formularios montados y sus borradores. No registra dosis, modifica pautas, envía mensajes ni concede permisos.

El gesto no comienza dentro de campos, botones, enlaces, navegación, diálogos ni zonas con desplazamiento propio. Tampoco se activa durante el tutorial, una operación pendiente, un gesto horizontal, un toque múltiple o desde la mitad de la página. El botón permite la misma operación sin gesto. Se evita ejecutar simultáneamente la recarga nativa y la actualización de datos.

La tarjeta «Tu equipo de salud» diferencia la solicitud enviada, «Solicitud aceptada. Seguimiento activo.» y seguimiento cerrado. Muestra el profesional asignado o indica que está pendiente de asignación, junto con el próximo seguimiento y las comunicaciones existentes. Se vuelve a consultar al regresar a la aplicación, al recuperar el foco, cada 30 segundos mientras está visible y al actualizar manualmente. Las lecturas automáticas se deduplican; las respuestas obsoletas no reemplazan datos posteriores. Un fallo manual se comunica al indicador de actualización.

El espacio inferior se reserva después de los enlaces del pie. Un ResizeObserver mide la barra real, incluidos el área segura del teléfono y el tamaño del texto. En escritorio, el pie ocupa su propia fila junto al menú lateral. El espaciado no depende de mantener el rebote al desplazar la pantalla.

## Verificación

`scripts/caregiver-refresh-browser-check.mjs` usa Chromium táctil y una base SQLite en memoria. Crea una solicitud y la acepta mediante la API del personal; verifica la actualización visible, recuperación del foco, error 503 y reintento, umbral del gesto, rechazo de gestos desde el medio de la página o un campo, conservación del borrador y ausencia de escrituras desde la página. Comprueba los seis enlaces del pie en 390x844, 320x568, 844x390 y 1366x768. La mutación temporal del umbral de 110 a 999 provoca el fallo esperado; restaurado el paquete, la prueba pasa.

Capturas técnicas en `work/caregiver-refresh-20261116/`. La simulación de navegador no sustituye una comprobación posterior en un iPhone y Android físicos con la PWA instalada.
