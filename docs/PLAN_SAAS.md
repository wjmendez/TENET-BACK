# CertiFlow SaaS Multi-tenant - Glosario y Plan

Fecha: 2026-02-17

## Glosario (clasico por categorias)

### SaaS y arquitectura
- SaaS (Software as a Service): software entregado como servicio en la nube; el cliente lo usa via web/API sin instalarlo.
- Multi-tenant: una misma plataforma sirve a muchos clientes (tenants) compartiendo infraestructura, con datos aislados.
- Tenant: cliente/organizacion dentro del SaaS (universidad, empresa, organizador). Es el "dueno" logico de los datos.
- Entorno del tenant: conjunto logico de datos/configuracion del tenant (branding, llaves, limites, emisores, plantillas, etc.).
- White-label: personalizacion de marca por tenant (logo, colores, dominio/subdominio, emails, etc.).
- Self-service onboarding: alta de tenant y configuracion inicial sin intervencion del equipo interno (sign-up -> listo para emitir).
- Control Plane: modulos de administracion (tenants, usuarios, roles, planes, dominios, API keys, auditoria).
- Data Plane: modulos operativos del producto (emision, verificacion, revocacion, anclaje, NFTs, batches, etc.).
- MVP (Minimum Viable Product): version minima funcional para validar en produccion lo esencial.
- Fase 2: funcionalidades que se agregan despues del MVP (por ejemplo, dominio propio del cliente / did:web del cliente).

### Identidad, permisos y seguridad
- Autenticacion (AuthN): comprobar quien es el usuario/sistema (login, JWT, API key).
- Autorizacion (AuthZ): decidir que acciones puede hacer (roles, scopes, politicas).
- RBAC (Role-Based Access Control): permisos basados en roles (owner/admin/issuer/viewer).
- Rol: etiqueta de permisos amplia asignada a un usuario dentro de un tenant.
- Scopes: permisos finos asociados a una API key o token (ej.: certificate:issue, certificate:revoke).
- Least privilege (minimo privilegio): otorgar solo los permisos estrictamente necesarios.
- API Key: secreto para que un sistema (o script) llame a la API sin login interactivo.
- Leak / filtracion de API key: exposicion accidental de la key; riesgo de abuso (emision masiva, cambios no autorizados).
- Hash (de secretos): huella irreversible usada para almacenar el secreto sin guardarlo en claro.
- Argon2id / bcrypt: algoritmos recomendados para hashear secretos (mejor que SHA simple).
- Revocacion de key: invalidar una API key (corta acceso inmediato).
- Rotacion de key: generar una nueva API key y reemplazar la anterior (higiene de seguridad).
- Rate limiting: limite de requests por segundo (por tenant o por API key) para evitar abuso.
- Kill switch: corte de emergencia (por ejemplo, suspender un tenant) ante incidentes.
- Audit log: registro de acciones (quien hizo que, cuando). Sirve para auditoria, NO como fuente de validez.

### Catalogo inicial de scopes
- API Keys: `api-keys:read`, `api-keys:write`
- Issuers: `issuers:read`, `issuers:write`
- Templates: `templates:read`, `templates:write`
- Credentials: `credentials:read`, `credentials:issue`, `credentials:revoke`, `credentials:reinstate`
- Anchors: `anchors:read`, `anchors:approve`
- Bundles: `bundles:read`, `bundles:write`, `bundles:anchor`
- Credential Types: `credential-types:read`, `credential-types:write`, `credential-types:validate`
- Verticals: `verticals:read`, `verticals:write`, `verticals:configure`
- NFTs: `nft:read`, `nft:mint`, `nft:transfer`, `nft:anchor`, `nft:issue`
- Smart Medals: `smart-medals:read`, `smart-medals:write`
- Events: `events:ingest`

### Scopes por plan (inicial)
- FREE: `api-keys:read`, `api-keys:write`, `issuers:read`, `issuers:write`, `templates:read`, `templates:write`, `credentials:read`, `credentials:issue`, `anchors:read`, `anchors:approve`, `credential-types:read`, `verticals:read`, `bundles:read`, `nft:read`, `nft:mint`, `nft:anchor`, `nft:issue`, `smart-medals:read`
- TRIAL: todos los de FREE + `credentials:revoke`, `credentials:reinstate`, `credential-types:write`, `credential-types:validate`, `verticals:configure`, `bundles:write`, `bundles:anchor`, `nft:transfer`, `smart-medals:write`, `events:ingest`
- PRO: todos los de TRIAL + `verticals:write`

### Base de datos (Postgres) y multi-tenant
- PostgreSQL (Postgres): base de datos relacional usada como store principal.
- Fila (row): registro individual en una tabla.
- RLS (Row-Level Security): seguridad a nivel de fila en Postgres; filtra/valida automaticamente por tenant.
- Policy (RLS policy): regla que define que filas se pueden leer/escribir.
- FORCE RLS: obliga a que RLS aplique siempre, reduciendo bypasses.
- Tenant context: tenantId resuelto por request y aplicado a la sesion DB.
- SET LOCAL app.tenant_id: forma comun de setear el tenant en la transaccion para que RLS funcione.
- Migration: cambio versionado del esquema (crear/alterar tablas/indices/constraints).
- Backfill: llenar columnas nuevas en datos existentes (ej.: poblar tenantId).
- Foreign Key (FK): relacion entre tablas que garantiza integridad referencial.
- Unique constraint: regla que impide duplicados.
- Composite unique: unique compuesto (ej.: UNIQUE(tenantId, slug)), clave en multi-tenant.
- Index (indice): estructura para acelerar consultas; esencial cuando se filtra por tenantId.
- Schema-per-tenant: un esquema por tenant (aislamiento logico medio; mas operacion).
- DB-per-tenant: una base por tenant (aislamiento alto; operacion mas compleja/cara).

### Cuotas, limites y performance
- Plan: conjunto de limites y features habilitadas (FREE/TRIAL/PRO).
- Quota (cuota): limite por periodo (ej.: emisiones/mes, api calls/mes).
- Metering: medicion del uso para actualizar cuotas (contadores por tenant).
- Enforcement: aplicar la regla (bloquear o degradar funcionalidad al exceder cuota).
- RPS (Requests Per Second): requests por segundo (metrica tipica de rate limiting).
- p95 latency: tiempo de respuesta bajo el cual cae el 95% de requests (metrica clave).

### Infraestructura y DevOps
- Cloud (nube): infraestructura administrada (AWS/GCP/Azure/otros).
- Object Storage: almacenamiento de objetos (tipo S3) para CSV, imagenes, assets.
- Prefijo por tenant: convencion de paths por tenant en object storage (ej.: /tenants/{id}/...).
- CDN: red de distribucion para servir contenido rapido (util para verifier y assets).
- Observability (observabilidad): capacidad de entender el sistema en produccion (logs, metricas, trazas).
- Logs: registros de eventos/errores.
- Metrics: valores numericos (latencia, errores, throughput).
- Traces: trazas de una request entre servicios.
- CI/CD: pipeline de build/test/deploy automatico.
- Rollback: volver a una version anterior tras un incidente.

### Dominios y web
- Subdomain (subdominio): {tenant}.certiflow.app. En el MVP es el camino recomendado (no depende del cliente).
- Custom domain (dominio propio): certificados.cliente.com. Entra como Fase 2 (opt-in).
- DNS: sistema que traduce nombres de dominio a recursos.
- CNAME: registro DNS para apuntar un dominio a otro.
- TXT record: registro DNS usado para verificacion de ownership.
- TLS/SSL: cifrado HTTPS.
- Certificado TLS: certificado que habilita HTTPS en un dominio.
- Cache-Control: header HTTP para controlar cache.
- ETag: identificador para validar cambios y mejorar caching.

### Identidad descentralizada, credenciales y verificacion
- DID (Decentralized Identifier): identificador verificable de una entidad (issuer/usuario) que se resuelve a un DID Document.
- did:web: metodo DID que se resuelve via HTTPS, publicando /.well-known/did.json.
- DID Document (did.json): documento que publica claves y endpoints asociados a un DID.
- Issuer (Emisor): entidad que firma y emite credenciales (universidad/organizador).
- Subject/Holder: titular de la credencial (alumno/corredor).
- Verifier: quien verifica autenticidad/validez de la credencial.
- VC (Verifiable Credential): credencial verificable firmada (estandar W3C).
- JWT/JWS: formatos comunes para empaquetar y firmar tokens/credenciales.

### Blockchain, anclaje y NFTs
- Anchor (anclaje): publicar una huella (hash/merkle root) en blockchain para inmutabilidad.
- Merkle tree / Merkle root: estructura para agrupar hashes y generar pruebas de pertenencia eficientes.
- Merkle proof: prueba de que un hash pertenece al arbol cuyo root esta anclado.
- Txid: identificador de transaccion en blockchain.
- EVM: entorno compatible con Ethereum (Polygon/Base/otras redes EVM).
- NFT: token no fungible que puede representar un "trofeo" o prueba publica.
- ERC-1155: estandar NFT eficiente para emision masiva.
- Minting: proceso de crear/acunar un NFT en cadena.
- Metadata (NFT): JSON asociado al NFT (evitar PII on-chain; usar links/hashes).

### Revocacion (validez de credenciales)
- Revocacion (revocation): invalidar una credencial emitida.
- Suspension (suspension): invalidacion temporal (opcional).
- Status List 2021: estandar W3C para listas de estado (bitstring) que permite verificar revocacion de forma rapida y cacheable.
- Bitstring: secuencia de bits (0/1) donde cada indice representa el estado de una credencial.

### Gestion de llaves y firma
- KMS (Key Management Service): servicio para almacenar llaves privadas y firmar sin exponerlas.
- HSM: hardware de alta seguridad para llaves (mas estricto que KMS, segun proveedor).
- CMK (Customer Managed Key): llave gestionada por el equipo dentro del KMS.
- Key rotation (rotacion de llaves): cambiar llaves de firma sin romper verificaciones historicas.
- Key history: historial de llaves publicas usadas para validar credenciales emitidas en el pasado.

## Estado actual vs objetivo

- Hoy hay particion logica por Vertical, pero no existe un Control Plane ni tenantId en tablas.
- No hay Auth, RLS ni API keys con scopes.
- Veramo usa kms-local (memoria), no KMS externo.
- Revocacion actual usa lista estilo Blockcerts; no hay Status List 2021.

## Plan por sprints (resumen)

| Sprint | Objetivo | Entregables | DoD |
|---|---|---|---|
| S1 | Multi-tenant base | Control Plane + tenantId en Data Plane + tenant resolution | Endpoints funcionan con tenantId resuelto |
| S2 | RLS + API keys seguras | RLS + policies + scopes + enforcement + revocacion/rotacion | Tests cross-tenant pasan; scopes obligatorios |
| S3 | KMS por tenant | KMS + rotacion + firma estable | Cada tenant firma con su key |
| S4 | Revocacion eficiente | Status List 2021 + endpoint cacheable | Revocar cambia verificacion en <5 min |
| S5 | Planes y cuotas | Metering + enforcement + rate limiting | Exceso bloquea emision con error claro |
| S6 | White-label | Branding basico + (opcional) custom domain | Branding visible por tenant |

## Detalle por sprint

### Sprint 1 - Multi-tenant base
**Entregables**
- Tablas Control Plane: tenant, user, membership, plan, tenant_plan, quota_usage, api_key, tenant_branding, audit_log.
- Backfill: crear tenant "default" para datos existentes.
- Agregar tenantId a tablas Data Plane: Vertical, CredentialType, Issuer, Template, CredentialBundle, Certificate, Anchor, NFT, CredentialUpdate.
- Tenant resolution: subdominio/JWT/API key (orden de precedencia definido).

**DoD**
- Endpoints operan con tenantId en contexto y no se mezclan tenants en lecturas/escrituras.
- Flujo de emision/verificacion funciona con subdominio del tenant.

### Sprint 2 - RLS + API keys seguras
**Entregables**
- ENABLE/FORCE RLS en tablas Data Plane y Control Plane por tenant.
- Policies select/insert/update/delete por tenantId.
- Middleware: SET LOCAL app.tenant_id por request.
- API keys: hashing, scopes obligatorios, enforcement en endpoints.
- Revocacion/rotacion de keys.
- Rate limiting por tenant y por api_key.

**DoD**
- Tests cross-tenant bloquean todo acceso indebido.
- Ningun endpoint sensible funciona sin scope correcto.

### Sprint 3 - KMS por tenant
**Entregables**
- Issuer: kmsKeyId, kmsKeyVersion, keyAlgorithm.
- Provisioning de key por tenant y asignacion a issuer.
- Firma via KMS al emitir.
- Rotacion de keys sin romper verificaciones historicas.

**DoD**
- Cada tenant firma con su key y no puede usar keys de otro tenant.

### Sprint 4 - Revocacion (Status Lists)
**Entregables**
- Tabla status_list (bitstring) y campos en Certificate: statusListId, statusListIndex, revokedAt, revocationReason.
- Emision asigna index de status list de forma atomica.
- Endpoint publico cacheable: /.well-known/status/{statusListId}.

**DoD**
- Verificador usa status list cacheable.
- Revocar actualiza estado visible en <= 5 minutos (TTL cache).

### Sprint 5 - Planes y cuotas
**Entregables**
- Metering de emisiones y API calls por tenant.
- Enforcement por plan (FREE/TRIAL/PRO sin cobro).
- Rate limiting activo.

**DoD**
- Tenant excedido no puede emitir y recibe error claro.

### Sprint 6 - White-label y dominios (opcional)
**Entregables**
- Branding basico por tenant (logo/colores).
- (Opcional) custom domain con verificacion DNS/HTTP.

**DoD**
- Portal/verificador reflejan branding del tenant.

## Definition of Done (MVP completo)

**Seguridad / Aislamiento**
- RLS forzado y policies activas en Data Plane.
- Tests de aislamiento cross-tenant.
- API keys con hash + scopes + revocacion/rotacion.
- Rate limiting por tenant y api_key.

**Criptografia**
- Firma por tenant via KMS.
- Rotacion sin romper verificaciones historicas.

**Revocacion**
- Status lists implementadas y cacheables.

**Operacion SaaS**
- Onboarding self-service (tenant + owner + subdominio).
- Branding basico por tenant.
- Cuotas por plan aplicadas.
