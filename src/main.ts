import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { EmptyBodyInterceptor } from './common/interceptors/empty-body.interceptor.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function bootstrap() {
  const adapter = new FastifyAdapter({
    logger: true,
    bodyLimit: 10485760, // 10MB
    allowErrorHandlerOverride: true, // Permitir que NestJS establezca su error handler
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  // Obtener la instancia de Fastify para configurar hooks
  const fastifyInstance = app.getHttpAdapter().getInstance();

  // Configurar hook onRequest para manejar bodies vacíos antes del parsing
  fastifyInstance.addHook('onRequest', async (request: any, reply: any) => {
    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      // Si Content-Type es JSON pero no hay body, establecer body vacío
      const contentLength = request.headers['content-length'];
      if (!contentLength || contentLength === '0') {
        request.body = {};
      }
    }
  });

  // Habilitar CORS para cualquier origen (necesario para Swagger UI)
  app.enableCors({
    origin: true, // Permitir cualquier origen
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-API-Key'],
  });

  // Agregar filtro global de excepciones para mejor manejo de errores
  // Este filtro maneja errores de parsing de JSON y otros errores HTTP
  app.useGlobalFilters(new HttpExceptionFilter());

  // Agregar interceptor global para manejar bodies vacíos
  // El hook onRequest de Fastify también maneja esto antes del parsing
  app.useGlobalInterceptors(new EmptyBodyInterceptor());

  // Configurar archivos estáticos desde la carpeta public
  const fastifyStatic = await import('@fastify/static');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await fastifyInstance.register(fastifyStatic.default as any, {
    root: join(__dirname, '..', 'public'),
    prefix: '/',
  });

  const config = new DocumentBuilder()
    .setTitle('Cert Backend API')
    .setDescription(
      `# API para Emisión y Anclaje de Certificados Blockchain

Esta API permite crear, emitir y anclar certificados digitales verificables (Verifiable Credentials) 
usando el estándar Blockcerts y anclaje a blockchain.

## Características principales

- **Plantillas de certificados**: Crea plantillas con diseño visual (canvas) y estructura JSON-LD completa
- **Emisión en lote**: Emite múltiples certificados usando plantillas con variables
- **Anclaje a blockchain**: Ancla certificados a Ethereum (Sepolia) o redes locales (Besu)
- **Verificación**: Genera certificados en formato Blockcerts compatible con verificadores estándar

## Flujo de trabajo

1. **Crear plantilla**: Define el diseño y estructura del certificado usando \`POST /templates\`
2. **Emitir certificados**: Genera certificados para destinatarios usando \`POST /certificates/issue-batch\`
3. **Anclar a blockchain**: Ancla los certificados usando \`POST /anchor/approve\`
4. **Verificar**: Obtén el certificado en formato Blockcerts usando \`GET /certificates/:id/blockcerts\`

## Variables soportadas en plantillas

### Variables del Issuer (desde variables de entorno)
- \`{issuerDid}\`: DID del emisor (generado desde APP_URL)
- \`{issuerName}\`: Nombre del emisor (ISSUER_NAME)
- \`{issuerUrl}\`: URL del emisor (APP_URL)
- \`{issuerLogo}\`: Logo del emisor (ISSUER_LOGO)

### Variables del Recipient
- \`{{studentName}}\` o \`{studentName}\`: Nombre del estudiante
- \`{{studentDid}}\` o \`{studentDid}\`: DID del estudiante
- \`{{email}}\` o \`{email}\`: Email del estudiante
- \`{{courseName}}\` o \`{courseName}\`: Nombre del curso
- \`{{date}}\` o \`{date}\`: Fecha de emisión
- \`{{qrUrl}}\` o \`{qrUrl}\`: URL del QR code para verificación
- \`{{firmaDigital}}\` o \`{firmaDigital}\`: Firma digital (completada tras anclaje)

## Formato de variables

Se soportan dos formatos:
- **Doble llave**: \`{{variable}}\` - Recomendado para datos del recipient
- **Llave simple**: \`{variable}\` - Recomendado para datos del issuer

Ambos formatos son procesados automáticamente.`,
    )
    .setVersion('1.0')
    .addTag('Templates', 'Gestión de plantillas de certificados')
    .addTag('Certificates', 'Gestión de certificados emitidos')
    .addTag('Anchor', 'Anclaje de certificados a blockchain')
    .addTag('Blockcerts', 'Endpoints de Blockcerts (issuer, revocation list)')
    .addTag(
      'Issuers',
      'Gestión de DIDs y documentos DID de issuers (W3C DID Core)',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'jwt',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
      },
      'apiKey',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'Cert Backend API Documentation',
  });

  await app.listen(3100, '0.0.0.0');
  console.log('Application is running on: http://localhost:3100');
  console.log(
    '📚 Swagger documentation available at: http://localhost:3100/docs',
  );
  console.log(
    '🔐 Blockcerts Verifier available at: http://localhost:3100/verifier.html',
  );
}
void bootstrap();
