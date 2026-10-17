# TENET-BACK (CertiFlow API)

API multi-tenant para emitir y anclar credenciales verificables (Blockcerts v3 / DIDs con Veramo).
Stack: NestJS 11 + Fastify, Prisma + PostgreSQL, Redis (rate limit), Hardhat (contratos de anclaje y NFT).

## Entorno local

Requisitos: Node 22, Docker (con Compose).

```bash
cp .env.example .env              # luego editar JWT_SECRET y LOCAL_KMS_MASTER_KEY
docker compose up -d              # postgres :5432, redis :6379, minio :9000/:9001
npm install
npx prisma migrate deploy         # aplica las migraciones
npx prisma db seed                # tenant "default", planes, verticales y usuario admin
npm run start:dev                 # http://localhost:3100
```

- Swagger: http://localhost:3100/docs
- Login de desarrollo (viene del seed, ver `DEFAULT_ADMIN_*` en `.env`): `admin@certiflow.local` / `ChangeMe123!`
- Probar el login:
  ```bash
  curl -X POST localhost:3100/auth/login -H 'content-type: application/json' \
    -d '{"email":"admin@certiflow.local","password":"ChangeMe123!"}'
  ```
  Devuelve un `accessToken` (JWT) para usar como `Authorization: Bearer <token>`.

El frontend vive en el repo `TENET-FRONT` y espera esta API en `http://localhost:3100`.

### Anclaje a blockchain y NFTs (opcional)

Para anclar certificados o mintear NFTs hace falta un nodo Besu (`BESU_RPC_URL`, por defecto `http://localhost:8545`)
o una RPC de Sepolia, más las claves privadas y de Pinata en `.env`. Sin eso el resto de la API funciona igual.
Ver `GUIA_COMPLETA_ENDPOINTS.md`, `GUIA_SPORTSTECH_NFT.md` y `VERIFICACION_IPFS_BESU.md`.

## Scripts

```bash
npm run start:dev    # desarrollo con watch
npm run build        # compila a dist/
npm run start:prod   # node dist/main.js (requiere build previo)
npm run lint
npm run test         # unit tests
npm run test:e2e     # e2e (requiere Postgres y Redis arriba)
```

## Secretos

- Nunca subas `.env` ni claves a git; usá `.env.example` para documentar variables.
- Los valores de `.env.example` son solo para desarrollo local. En producción usá un gestor de secretos y rotá las claves.
