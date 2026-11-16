# Corrección visual del tutorial y marca de la landing

Publicada el 16/11/2026 a las 19:41 UTC, con el sí explícito de Simon para desplegar el tour y el logo. Commit funcional 38ffb34, PR 10.

El tutorial ahora usa cuatro paneles oscuros alrededor de un recorte transparente. El recorte sigue el control concreto, sin elevar toda la navegación lateral. El cuadro explicativo mide su tamaño real y busca espacio arriba, abajo o a los lados. En pantallas angostas ajusta el desplazamiento; en horizontal limita la altura del cuadro y permite desplazar su contenido. Los pasos de lectura interceptan clics y los pasos de acción permiten tocar únicamente el control iluminado. La navegación inferior no debe cubrir las acciones.

La landing usa `public/pwa/brand-mark.png`, sin palabra incorporada ni fondo opaco, a 72 px en escritorio y 56 px en móvil. Conserva una sola etiqueta HTML Fuerte. Se editó el original con la herramienta integrada de imágenes: retirar la palabra y el fondo, conservar el símbolo verde/terracota, centrarlo con margen pequeño y salida transparente. Se optimizó a 256 x 256 px para el sitio. No cambia los iconos de instalación ni el encabezado interno de la aplicación.

Verificación local: el build anterior reprodujo la superposición del paso 2 (41 432 px cuadrados). El nuevo recorrido completo pasa en 1536x754, 1917x940, 1366x768, 390x844, 320x568 y 844x390. En cada tamaño se comprobaron alineación, área iluminada sin solapamiento del cuadro, clics reales, finalización, reinicio, Escape y ausencia de peticiones de escritura. Los registros y la versión de la pauta permanecieron intactos en SQLite en memoria. Evidencia en `work/tour-visibility-20261116/`; comprobación repetible con `scripts/tour-browser-check.mjs` (Playwright y Chromium instalados, variables opcionales RUNTIME_NODE_MODULES y TOUR_CHROMIUM).

TypeScript, Oxlint, build del producto y comprobaciones existentes de tutorial, PWA, servidor y landing correctos. Las pruebas existentes de tutorial, PWA y landing incluyen mutaciones RED y restauración GREEN. El logo se comprobó en navegador en 320, 390 y 1366 px, incluida carga, transparencia real y texto único en la marca. Estas son verificaciones técnicas locales, no sesiones académicas con usuarios.

Alcance de publicación: solo estáticos. Conservar imagen anterior y recursos hash para pestañas abiertas; candidato aislado sin red y con datos efímeros; recrear únicamente app tras autorización. No modificar base de datos, servidor, servicio de IA, DNS ni los demás contenedores.

Publicación verificada: nueve archivos HTTPS coinciden con el paquete; servicio healthy, servidor y volumen fuerte_fuerte_data intactos, otros contenedores conservados. Respaldo /home/ubuntu/fuerte-app/.releases/tour-visibility-20261116T194142Z. Imagen anterior fuerte-app:before-recorrido-20261116T194142Z. Nueva imagen sha256:b0546b970a9015fb7c173ca660b7477412bbfd176b7bc93048071c4cf2e331ff. El sello 01 / 04 del libro sigue siendo decorativo; se explicó a Simon y queda pendiente de sincronizar si solicita ese cambio.

