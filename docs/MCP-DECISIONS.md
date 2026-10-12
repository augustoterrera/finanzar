# Decisiones de implementación MCP

Última actualización: 8 de octubre de 2026.

Este documento registra hallazgos del repositorio y las decisiones de F0. No acredita un despliegue ni acceso a datos de Production.

## Estado de F0

| Punto | Hallazgo | Decisión |
| --- | --- | --- |
| Aplicación | Next.js 16.3.4, React 19, TypeScript; producción en Vercel informada como `https://finanzar-vert.vercel.app`. | Servir MCP y OAuth desde el mismo origen, sujeto a comprobación en cliente. |
| Base de datos | Turso/libSQL con Drizzle; las tablas financieras no tienen propietario por fila. | Mantener el primer alcance como un libro privado vinculado explícitamente a la cuenta única. No presentar esto como multiusuario. |
| Autenticación existente | `better-auth` y `@better-auth/drizzle-adapter` fijados en 1.7.7; usuario y contraseña; el alta inicial está cerrada tras crear la cuenta. | Extender el proveedor instalado; no cambiar el login ni abrir registro. |
| MCP | Se verificó e instaló `@better-auth/mcp@1.7.7`, `@better-auth/cimd@1.7.7`, `@modelcontextprotocol/server@2.3.1` y `zod@4.6.1`; peers compatibles con Better Auth 1.7.7. | Fijados en `package.json`/lockfile; habilitación OAuth temporalmente detrás de `MCP_OAUTH_ENABLED=true`. |
| Protocolo | Better Auth 1.7.7 documenta JWT/CIMD y el SDK TypeScript v2 sirve MCP `2026-07-28` stateless. | El handler usa `legacy: "reject"`. Prueba local de HTTP con OAuth real en fixture; clientes externos todavía no verificados. |
| Recurso | Dominio declarado actualizado a `https://finanzar-vert.vercel.app`. | Proponer como recurso canónico `https://finanzar-vert.vercel.app/api/mcp`; revisar que issuer, metadata, audience y ruta de discovery coincidan con lo que genera la versión instalada. |
| Login OAuth | El POST actual de inicio de sesión redirige al inicio de Finanzar. Better Auth necesita retomar el flujo de autorización después del login. | El retorno OAuth se validará por ruta/origen y se conservará el estado; no aceptar redirects externos. |
| Proxy Next | `src/proxy.ts` protege las páginas y no intercepta `/api/*`; las rutas `.well-known` podrían redirigirse si se agregan bajo el matcher actual. | Validar OAuth en handler y servicio. Permitir únicamente las rutas públicas de discovery requeridas; no abrir páginas de datos. |
| Datos | Montos en centavos; splits distinguen responsable de pagador; los grupos de cuotas conservan total de compra. | Extraer lógica a servicios compartidos antes de publicar tools. |
| Vercel env local | `vercel-production.env` está ignorado por Git, permisos `0600`, y su `BETTER_AUTH_URL` local coincide con el dominio declarado. | El dueño informó que ya actualizó Production. El agente no verificó el dashboard; no hace falta cambiar más variables para F0. |
| Migración OAuth | Esquema Better Auth generado y revisado con CLI 1.7.7; `drizzle/0005_mcp_oauth.sql` crea únicamente tablas/índices de OAuth, JWT y CIMD. | Migración local aditiva; no aplicada. La bandera `MCP_OAUTH_ENABLED` evita activar el plugin antes de que el esquema esté migrado y el flujo de consentimiento completo. |
| URL desplegada | La herramienta de documentación no pudo leer la URL pública durante la comprobación. | La conectividad/estado público de Production queda **sin verificar**, no se infiere un error del sitio. |

## Decisiones por validar antes de F3

1. Confirmar mediante el paquete realmente instalado qué imports, scopes y esquema admite Better Auth MCP 1.7.7 y su adaptador Drizzle.
2. Verificar cómo se enlaza un access token validado a una concesión revocable, incluida la expiración y refresh; no añadir una caché de JWT que impida revocar.
3. Comprobar metadata OAuth y resource discovery generados en el origen final, incluso issuer-path aliases y RFC 9207.
4. Probar la retoma del login existente y el consentimiento en los clientes que se quieran soportar. Registrar callbacks exactos desde cada cliente.
5. Confirmar el soporte real de MCP protocol/transport por cliente; los adaptadores de compatibilidad no pueden reducir las validaciones OAuth ni el alcance de los datos.

## Superficie de interfaz

- Hereda `DESIGN.md`, con modo operativo y el inicio actual intacto.
- Agrega ajustes de conexiones, consentimiento y revisión de cambios.
- La autorización muestra quién conecta, qué consulta o puede proponer, y cómo revocar.
- La aprobación muestra monto, moneda, responsables, medio/tarjeta, meses, alcance de cuotas y cambios anteriores/nuevos.
- No se usan estados del modelo como señal de aprobación. La confirmación es una acción autenticada en Finanzar.

## Estado de ejecución

- [ ] F0: versiones verificadas; build completo y metadata/estado del despliegue aún no verificados por las limitaciones de red/build anotadas.
- [x] F1: servicio compartido local para lectura y alta de movimientos/cuotas, con ownership comprobado; otras mutaciones siguen pendientes.
- [ ] F2: ownership y migraciones aditivas implementados y probados localmente; backup, rollback y aplicación remota pendientes.
- [x] F3: OAuth, consentimiento y revocación implementados/probados localmente detrás de flag; rollout no verificado.
- [ ] F4: consultas de solo lectura, guards Host/Origin, límite de body, errores MCP tipados y paridad local con dashboard probados; falta cliente real y metadata/interop específica.
- [ ] F5: propuestas, aprobación e idempotencia.
- [ ] F6: cuotas y correcciones.
- [ ] F7: catálogo, recurrentes y exportación opcional.
- [ ] F8: conexión verificada por cliente (ninguno probado todavía).
- [ ] F9: staging, operación y rollout.

## Condición de Production

El usuario informó que cambió `BETTER_AUTH_URL` en Vercel a `https://finanzar-vert.vercel.app`. Eso elimina la divergencia conocida entre el archivo local y el origen deseado. No se leyeron ni modificaron credenciales de Vercel ni se desplegó nada en esta fase.

## Decisiones de seguridad de transporte — F4, 8 de octubre de 2026

- Antes de verificar OAuth, el handler valida `Host` con `hostHeaderValidationResponse` del SDK. En producción se permite solo el hostname de `BETTER_AUTH_URL`/recurso; localhost se agrega únicamente cuando el recurso configurado es local.
- `Origin` ausente se acepta para clientes server-to-server, que luego deben presentar token. Si está presente, se rechazan orígenes inválidos/`null`, se valida el hostname y se exige igualdad exacta con el origen configurado (esquema y puerto incluidos). Esto evita permitir un origen HTTP solo por compartir hostname con el HTTPS de producción.
- Respuestas de rechazo MCP incluyen `private, no-store` y `Vary: Authorization, Origin, Host`.
- El SDK rechaza cuerpos MCP mayores a 64 KiB durante la lectura (incluye límite por `Content-Length` y por bytes observados) con HTTP 413, antes del parseo JSON-RPC.
- Los resultados de error de herramientas usan `isError: true` y códigos estables: `NOT_FOUND` para recursos inexistentes, `VALIDATION_ERROR` para filtros/cursor inválidos y `INTERNAL_ERROR` genérico para fallos inesperados; estos últimos no incluyen mensajes internos.
- Los navegadores/extensiones de clientes con orígenes distintos no se agregan de forma amplia. Solo añadir un origen concreto tras verificar documentación y una conexión real del cliente que se pretenda soportar.
- Pruebas locales cubren Host ajeno, Origin ajeno, esquema distinto, mismo origen y ausencia de Origin. No equivalen a una conexión en ChatGPT/Claude/Gemini.
