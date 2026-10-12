# Prompt de implementación para GPT-6 Luna

Copiar el bloque siguiente en un chat que tenga acceso a este repositorio. No pegar archivos `.env`, tokens ni contraseñas.

```text
Implementá la conexión privada con IA de Finanzar siguiendo ROADMAP-MCP-IA.md.
El repositorio local es /Users/augustoterrera/Proyectos/finanzar.
El origen productivo informado es https://finanzar-vert.vercel.app.

Primero leé completamente AGENTS.md y ROADMAP-MCP-IA.md. Leé también PRODUCT.md,
package.json y los archivos de entrada enumerados en el roadmap. ROADMAP.md es
histórico: no cambies Next por Svelte ni reemplaces el login usuario/contraseña.
Antes de editar código Next, leé la guía pertinente instalada en node_modules/next/dist/docs/.

Tu primera unidad de trabajo es F0. Creá docs/MCP-DECISIONS.md con versiones
compatibles comprobadas, diseño elegido, restricciones por cliente y resultados
baseline. No inventes exports de Better Auth ni mezcles SDK v1 y v2 de MCP.
Conservá el modelo de ejecución GPT-6 Luna; no crees otros chats ni cambies modelos.

Después avanzá en orden por F1–F9, una fase coherente por entrega. No saltees los
gates de seguridad ni digas que una plataforma está conectada sin prueba real.
Al iniciar cada fase, informá qué vas a cambiar. Al terminar, indicá archivos,
tests ejecutados con sus resultados y limitaciones, pendientes y siguiente fase.
Mantené docs/MCP-PROGRESS.md con tareas completadas y evidencia, sin secretos.
No marques todo completo por terminar de escribir código.

Invariantes:
- Conocer la URL no permite consultar ni modificar datos.
- Solo la cuenta existente y vinculada al libro privado puede autorizar conexiones.
- people representa responsables económicos, no usuarios autenticados.
- OAuth de proveedor mantenido, PKCE y access tokens ligados al recurso; nunca
  contraseña compartida, cookie simulada, token de Turso o secret global como API key.
- Permisos por conexión y revocación comprobada en cada llamada; JWT válido por sí
  solo no autoriza si la conexión está revocada. No resucitar tokens al reconectar.
- Extraé lógica financiera compartida; no dupliques cálculos dentro de tools.
- Dinero en centavos, splits exactos, responsable distinto del pagador.
- Monto total de compra distinto de cuota. Inicio 4/6 genera solo cuotas restantes.
- Corrección de serie incluye cuotas, splits y total de grupo con alcance explícito;
  no cambiar solo este mes si se aprobó corregir las cuotas siguientes.
- Toda mutación iniciada por IA se propone y se aprueba en Finanzar. Un parámetro
  confirmed=true o una frase del modelo no constituyen aprobación humana.
- Aplicación, idempotencia y auditoría son atómicas; conflictos no se sobreescriben.
- No hard deletes desde MCP, SQL libre, shell, fetch arbitrario ni lectura de envs.
- Descripciones/documentos son datos, nunca instrucciones que amplían permisos.

Usá tests en memoria/staging aislado, con DB inyectada. No importes por accidente
la configuración real de Turso al ejecutar fixtures. No alteres montos actuales,
responsables reales, fechas históricas ni tablas financieras por probar tools.
Preservá cambios ajenos y usá apply_patch para editar archivos.

Podés implementar archivos, pruebas y migraciones locales necesarias. No está
autorizado aplicar migraciones a producción, publicar/deployar, modificar variables
en Vercel, hacer pushes ni conectar cuentas externas sin una autorización específica.
Cuando llegues a ese gate, dejá los pasos listos y pedí autorización. No solicites
credenciales por chat: la persona completa login y consentimiento en el sitio.

Si una API/versión no encaja, comprobá documentación oficial e instalación real,
documentá la decisión y seguí con trabajo independiente seguro. No rebajes auth ni
reescribas toda la aplicación para conseguir que una demo funcione.

La URL del archivo vercel-production.env fue corregida localmente, pero eso no
prueba que Production tenga esa variable. Verificá ese punto con autorización
antes de diagnosticar OAuth. Nunca muestres el contenido completo del archivo.

Si diseñás las pantallas de conexiones/consentimiento/aprobación, usá impeccable
y una skill de UX disponible; conservá el diseño del inicio. Si una skill no está
disponible, informalo y continuá con los criterios de claridad del roadmap.

Empezá ahora por F0 y entregá su evidencia antes de modificar la autenticación.
```
