# Validación de clientes MCP

Última actualización: 10 de octubre de 2026.

No se considera a un cliente compatible por el hecho de que el handler local responda. Completar cada fila solo después de configurar ese cliente con la URL pública, realizar OAuth interactivo y probar consultas y revocación.

| Cliente | Estado | Pendiente para validar |
| --- | --- | --- |
| MCP Inspector | No probado | Conectar contra staging accesible; confirmar discovery `server/discover`, OAuth/PKCE, listado, consulta, refresh y revocación. |
| ChatGPT | No probado | Confirmar disponibilidad del conector MCP en la cuenta/workspace, flujo OAuth/callback actual, consultas y revocación. |
| Claude | Parcial: probado localmente por ngrok | El 10/10 completó OAuth, lectura y creación/aplicación de un gasto de prueba con confirmación explícita. El scope write se añadió al pedido OAuth solo con `MCP_LOCAL_WRITE_SCOPE=true` y se autorizó en Finanzar. Falta probar refresh y revocación; no está validado en Vercel/producción. |
| Gemini CLI | No probado | Probar transporte HTTP/OAuth y herramientas de lectura; dejar `trust` desactivado. |
| Gemini web | No probado | Comprobar elegibilidad regional/cuenta sin eludir restricciones. |

## Seguridad de transporte aplicada localmente

- La URL canónica de recurso y su hostname provienen de `BETTER_AUTH_URL`/configuración del servidor, nunca de `Host` o `Origin` enviados por el cliente.
- `Host` debe corresponder al recurso. Localhost solo se agrega a la allowlist cuando el recurso también es local.
- Se permite `Origin` ausente para clientes server-to-server, pero estos deben superar autenticación Bearer. Si se envía, el origen debe coincidir exactamente con el origen configurado, incluido esquema y puerto; `Origin: null` se rechaza.
- Para permitir un origen de extensión/navegador distinto, primero identificarlo desde documentación vigente y una prueba real del cliente; añadir solo el hostname concreto. No habilitar comodines HTTP/HTTPS.
- Los rechazos no consultan datos financieros y salen con `private, no-store`.
- El cuerpo HTTP está limitado a 64 KiB en el SDK; las herramientas informan errores con `isError: true` y códigos estables (`NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`).

## Límite de la prueba local

El test usa el handler HTTP real del SDK y un token JWT generado por Better Auth en una base libSQL en memoria. La solicitud y respuesta se ejecutan como `Request`/`Response` dentro del proceso; el fetch de JWKS se simula con la JWKS que emitió el fixture. Esto valida protocolo, firma, audiencia, scope, grant, consultas y guards, pero **no** reemplaza una conexión desde MCP Inspector ni demuestra que ChatGPT, Claude o Gemini acepten el issuer o callback desplegados.

El smoke test externo requiere una URL de staging accesible, OAuth habilitado allí, migraciones aplicadas a una base de prueba y autorización explícita para usar ese entorno. No usar Production para la primera conexión.
