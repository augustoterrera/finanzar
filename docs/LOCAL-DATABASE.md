# Base local de desarrollo

La base Docker usa libSQL (compatible con el cliente que ya usa la app) y un volumen propio. Escucha solo en `127.0.0.1:8080`; no usa ni sincroniza datos de Turso.

## Primera vez

```sh
docker compose up -d db
pnpm db:local:migrate
pnpm dev:local-db
```

Abrí `http://localhost:3001/login/primer-acceso` y creá un acceso de desarrollo. El código local fijo es `finanzar-local-setup`; solo se inyecta al correr `pnpm dev:local-db`, que escucha exclusivamente en `127.0.0.1`. Después podés iniciar sesión en `http://localhost:3001/login`.

## Uso habitual

```sh
docker compose up -d db
pnpm dev:local-db
```

Para detener el contenedor sin perder datos: `docker compose stop db`. Para volver a iniciarlo: `docker compose start db`.

## Seguridad y datos

- `pnpm dev:local-db` fuerza la app a `http://127.0.0.1:8080` y no necesita un token de Turso.
- `pnpm dev:mcp-local` habilita OAuth/MCP únicamente para la app local, conservando la misma base Docker.
- `pnpm db:local:migrate` aplica las migraciones del repo únicamente a la URL fija de localhost; no lee `.env` ni `.env.local`.
- No apuntes scripts de desarrollo a Turso de producción ni copies credenciales remotas a Compose.
- El volumen `finanzar_libsql_data` persiste mientras exista. Borrarlo destruye los datos locales; no hace falta para el uso normal.
- En una Mac Intel, cambiá `latest-arm` por `latest` en `compose.yaml`.
