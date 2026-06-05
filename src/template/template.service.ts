import { Injectable } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { IssuerService } from '../issuer/issuer.service.js';
import { getTenantId } from '../common/tenant/tenant-context.js';


/**
 * Extrae variables de un objeto JSON buscando patrones {{variable}} y {variable}
 */
function extractVariables(obj: any): string[] {
  if (!obj) return [];

  const variables = new Set<string>();
  const objStr = JSON.stringify(obj);

  // Buscar patrones {{variable}} (doble llave)
  const doubleBraceRegex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = doubleBraceRegex.exec(objStr)) !== null) {
    variables.add(match[1]);
  }

  // Buscar patrones {variable} (llave simple, excluyendo los que ya están con doble llave)
  const singleBraceRegex = /\{(\w+)\}/g;
  while ((match = singleBraceRegex.exec(objStr)) !== null) {
    const varName = match[1];
    // Solo agregar si no es parte de {{variable}}
    if (!objStr.includes(`{{${varName}}}`)) {
      variables.add(varName);
    }
  }

  return Array.from(variables);
}

/**
 * Extrae variables del jsonLd completo (incluye el canvas si está en credentialSubject.certificate.design)
 */
function extractVariablesFromJsonLd(jsonLd: any): string[] {
  return extractVariables(jsonLd);
}

/**
 * Convierte un canvas (con objetos) a HTML para displayHtml
 * Genera HTML con divs posicionados absolutamente (formato compatible con el frontend)
 */
function canvasToHtml(canvas: any): string {
  if (!canvas || !canvas.canvas) {
    return '';
  }

  const { width, height, backgroundColor } = canvas.canvas;
  const objects = canvas.objects || [];

  // Crear contenido HTML con divs posicionados absolutamente
  let htmlContent = '';

  // Procesar cada objeto del canvas
  objects.forEach((obj: any) => {
    const objId = obj.id || `obj-${Math.random().toString(36).substr(2, 9)}`;
    const x = obj.x || 0;
    const y = obj.y || 0;
    const objWidth = obj.width || 0;
    const objHeight = obj.height || 0;

    switch (obj.type) {
      case 'rect':
        const rectBgColor = obj.fill || obj.backgroundColor || '#000';
        htmlContent += `<div class="canvas-object canvas-rect" data-object-id="${objId}" style="position: absolute; left: ${x}px; top: ${y}px; width: ${objWidth}px; height: ${objHeight}px; background-color: ${rectBgColor};"></div>`;
        break;
      case 'text':
        const fontSize = obj.fontSize || 16;
        const fontFamily = obj.fontFamily || 'Arial, sans-serif';
        const fontWeight = obj.fontStyle === 'bold' ? 'bold' : 'normal';
        const fontStyle = obj.fontStyle === 'italic' ? 'italic' : 'normal';
        const textAlign = obj.align || 'left';
        const textColor = obj.fill || obj.color || '#000';
        const textContent = obj.text || '';
        htmlContent += `<p class="canvas-object canvas-text" data-object-id="${objId}" style="position: absolute; left: ${x}px; top: ${y}px; font-size: ${fontSize}px; font-family: ${fontFamily}; color: ${textColor}; text-align: ${textAlign}; font-style: ${fontStyle}; font-weight: ${fontWeight}; width: ${objWidth}px; margin: 0; padding: 0;">${textContent}</p>`;
        break;
      case 'qr':
        // Para QR codes, usar un div con data attribute para el QR data
        const qrData = obj.qrData || obj.data || '{{qrUrl}}';
        htmlContent += `<div class="canvas-object canvas-qr" data-object-id="${objId}" data-qr-data="${qrData}" style="position: absolute; left: ${x}px; top: ${y}px; width: ${objWidth}px; height: ${objHeight}px;"></div>`;
        break;
      case 'star':
        // Generar una estrella SVG
        const innerRadius = obj.innerRadius || 30;
        const outerRadius = obj.outerRadius || 50;
        const numPoints = obj.numPoints || 5;
        const opacity = obj.opacity || 1;
        const fill = obj.fill || '#000';
        
        // Calcular puntos de la estrella
        let points = '';
        for (let i = 0; i < numPoints * 2; i++) {
          const angle = (i * Math.PI) / numPoints;
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const px = 50 + radius * Math.cos(angle - Math.PI / 2);
          const py = 50 + radius * Math.sin(angle - Math.PI / 2);
          points += `${px},${py} `;
        }
        
        htmlContent += `<svg class="canvas-object canvas-star" data-object-id="${objId}" style="position: absolute; left: ${x}px; top: ${y}px; opacity: ${opacity}; width: ${objWidth}px; height: ${objHeight}px;" width="${objWidth}" height="${objHeight}"><polygon points="${points.trim()}" fill="${fill}" stroke="none" stroke-width="0"/></svg>`;
        break;
      default:
        // Para otros tipos, intentar renderizar como div genérico
        if (objWidth && objHeight) {
          const bgColor = obj.fill || obj.backgroundColor || 'transparent';
          htmlContent += `<div class="canvas-object" data-object-id="${objId}" style="position: absolute; left: ${x}px; top: ${y}px; width: ${objWidth}px; height: ${objHeight}px; background-color: ${bgColor};"></div>`;
        }
    }
  });

  // Crear el HTML completo con el contenedor principal
  const html = `<div class="certificate-template" style="width: ${width}px; height: ${height}px; background-color: ${backgroundColor || '#ffffff'}; position: relative; overflow: hidden;">${htmlContent}</div>`;

  return html;
}

/**
 * Genera un jsonLd completo de VerifiableCredential desde el canvas
 * Usa displayHtml para el diseño visual (estándar Blockcerts)
 */
function generateJsonLdFromCanvas(
  canvas: any,
  variables: string[],
  business?: { did: string; name: string; url?: string; logo?: string }
): Record<string, any> {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  // Detectar si hay courseName o curso en las variables
  const hasCourse = variables.some(v =>
    ['courseName', 'course', 'curso'].includes(v.toLowerCase())
  );

  // Convertir canvas a HTML para displayHtml
  const displayHtml = canvasToHtml(canvas);

  // Construir la estructura completa de VerifiableCredential
  const jsonLd: Record<string, any> = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/blockcerts/v3',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json' // Open Badges v3 para achievement
    ],
    type: ['VerifiableCredential', 'BlockcertsCredential'],
    issuer: {
      id: business?.did || '{issuerDid}',
      name: business?.name || '{issuerName}',
      ...(business?.url && { url: business.url }),
      ...(business?.logo && { image: business.logo }),
      ...(!business?.url && { url: '{issuerUrl}' }),
      ...(!business?.logo && { image: '{issuerLogo}' })
    },
    issuanceDate: '{{date}}',
    credentialSubject: {
      id: '{{studentDid}}',
      name: '{{studentName}}',
    }
  };

  // Agregar courseName directamente al credentialSubject si hay curso
  // (en lugar de achievement que requiere estructura compleja de Open Badges)
  if (hasCourse) {
    jsonLd.credentialSubject.courseName = '{{courseName}}';
  }

  // Usar display con contentMediaType y content para el diseño visual (estándar W3C Verifiable Credentials)
  // Formato: { "display": { "contentMediaType": "text/html", "content": "<div>...</div>" } }
  if (displayHtml) {
    jsonLd.display = {
      contentMediaType: 'text/html',
      content: displayHtml
    };
  }

  // Agregar metadata del certificado si existe
  if (canvas.metadata) {
    jsonLd.credentialSubject.certificate = {
      version: canvas.version || '1.0',
      metadata: canvas.metadata
    };
  }

  // Agregar proof
  jsonLd.proof = {
    type: 'Ed25519Signature2020',
    created: '{{date}}',
    verificationMethod: business?.did ? `${business.did}#key-1` : '{issuerDid}#key-1',
    proofPurpose: 'assertionMethod',
    proofValue: '{{firmaDigital}}'
  };

  return jsonLd;
}

/**
 * Integra la información del business en el jsonLd existente
 */
function integrateBusinessIntoJsonLd(
  jsonLd: any,
  business?: { did: string; name: string; url?: string; logo?: string }
): any {
  if (!business || !jsonLd) return jsonLd;

  // Clonar para no mutar el original
  const result = JSON.parse(JSON.stringify(jsonLd));

  // Actualizar issuer si existe
  if (result.issuer) {
    result.issuer.id = business.did;
    result.issuer.name = business.name;
    if (business.url) result.issuer.url = business.url;
    if (business.logo) result.issuer.image = business.logo;
  } else {
    result.issuer = {
      id: business.did,
      name: business.name,
      ...(business.url && { url: business.url }),
      ...(business.logo && { image: business.logo })
    };
  }

  // Actualizar verificationMethod en proof si existe
  if (result.proof && result.proof.verificationMethod) {
    result.proof.verificationMethod = result.proof.verificationMethod.replace(
      /{issuerDid}|did:example:.*/,
      business.did
    );
  }

  return result;
}

@Injectable()
export class TemplateService {
  constructor(private readonly issuerService: IssuerService) {}

  async create(data: any) {
    const tenantId = getTenantId();
    // Extraer información del business si existe
    const business = data.business;

    // Si hay business, crear o encontrar el issuer usando IssuerService (que usa Veramo)
    let issuerId: string | undefined;
    if (business) {
      // Usar IssuerService que ahora gestiona DIDs con Veramo
      const issuer = await this.issuerService.findOrCreateIssuer({
        did: business.did,
        name: business.name,
        url: business.url,
        logo: business.logo
      });

      // Actualizar business.did con el DID generado/encontrado
      business.did = issuer.did;
      issuerId = issuer.id;
    }

    // Inicializar jsonLd si no existe
    if (!data.jsonLd) {
      data.jsonLd = {};
    }

    // Procesar HTML: si viene HTML directamente, usarlo; si no, convertir desde canvas
    let displayHtml: string | undefined;
    if (data.html && typeof data.html === 'string') {
      // Si viene HTML directamente, usarlo
      displayHtml = data.html;
    } else if (data.canvas) {
      // Si viene canvas, convertirlo a HTML
      displayHtml = canvasToHtml(data.canvas);
    }

    // Integrar displayHtml en jsonLd según el estándar Blockcerts/W3C
    if (displayHtml) {
      // Usar el formato estándar W3C Verifiable Credentials para display
      if (!data.jsonLd.display) {
        data.jsonLd.display = {};
      }
      data.jsonLd.display.contentMediaType = 'text/html';
      data.jsonLd.display.content = displayHtml;
      
      // También mantener displayHtml para compatibilidad con Blockcerts
      data.jsonLd.displayHtml = displayHtml;
    }

    // Si hay canvas pero no jsonLd completo, generar estructura base desde el canvas
    if (data.canvas && !data.jsonLd['@context']) {
      // Extraer variables del canvas primero
      const variablesFromCanvas = extractVariables(data.canvas);
      const allVariables = new Set([
        ...(Array.isArray(data.variables) ? data.variables : []),
        ...variablesFromCanvas
      ]);
      const variables = Array.from(allVariables);
      const generatedJsonLd = generateJsonLdFromCanvas(data.canvas, variables, business);
      
      // Combinar con jsonLd existente (si hay)
      data.jsonLd = {
        ...generatedJsonLd,
        ...data.jsonLd,
        // Asegurar que displayHtml se mantenga
        display: data.jsonLd.display || generatedJsonLd.display,
        displayHtml: data.jsonLd.displayHtml || generatedJsonLd.displayHtml
      };
    }

    // Extraer variables del jsonLd completo y del HTML si existe
    const variablesFromJsonLd = data.jsonLd ? extractVariablesFromJsonLd(data.jsonLd) : [];
    const variablesFromHtml = displayHtml ? extractVariables(displayHtml) : [];
    
    // Combinar todas las variables únicas
    const allVariables = new Set([
      ...(Array.isArray(data.variables) ? data.variables : []),
      ...variablesFromJsonLd,
      ...variablesFromHtml
    ]);

    // Si no hay variables explícitas o están vacías, usar las extraídas
    if (!data.variables || !Array.isArray(data.variables) || data.variables.length === 0) {
      data.variables = Array.from(allVariables);
    } else {
      // Si hay variables explícitas, combinarlas con las extraídas
      data.variables = Array.from(new Set([...data.variables, ...allVariables]));
    }

    // Si hay jsonLd y business, integrar la información del business en el jsonLd
    if (data.jsonLd && business) {
      data.jsonLd = integrateBusinessIntoJsonLd(data.jsonLd, business);
    }

    // Limpiar campos temporales antes de guardar (business, canvas, html, filePath)
    // Estos ya están integrados en jsonLd o no se necesitan en la BD
    const { business: _, canvas: __, html: ___, filePath: ____, ...templateData } = data;

    // Agregar issuerId si existe
    if (issuerId) {
      templateData.issuerId = issuerId;
    }

    templateData.tenantId = tenantId;

    return prisma.template.create({ data: templateData });
  }

  async findAll() {
    const tenantId = getTenantId();
    return prisma.template.findMany({ where: { tenantId } });
  }

  async findOne(id: string) {
    const tenantId = getTenantId();
    return prisma.template.findFirst({ where: { id, tenantId } });
  }

  async remove(id: string) {
    const tenantId = getTenantId();
    const existing = await prisma.template.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error(`Template with id ${id} not found`);
    }
    return prisma.template.delete({ where: { id } });
  }
}
