import { v4 as uuidv4 } from 'uuid';

/**
 * Convierte un canvas (con objetos) a HTML para displayHtml
 * Esta función debe ser idéntica a la de template.service.ts
 */
function canvasToHtml(canvas: any): string {
  if (!canvas || !canvas.canvas) {
    return '';
  }

  const { width, height, backgroundColor } = canvas.canvas;
  const objects = canvas.objects || [];

  // Crear SVG para renderizar el diseño
  let svgContent = '';

  // Procesar cada objeto del canvas
  objects.forEach((obj: any) => {
    switch (obj.type) {
      case 'rect':
        svgContent += `<rect x="${obj.x || 0}" y="${obj.y || 0}" width="${obj.width || 0}" height="${obj.height || 0}" fill="${obj.fill || '#000'}" />`;
        break;
      case 'text':
        const fontSize = obj.fontSize || 16;
        const fontFamily = obj.fontFamily || 'Arial';
        const fontWeight = obj.fontStyle === 'bold' ? 'bold' : 'normal';
        const textAnchor = obj.align === 'center' ? 'middle' : obj.align === 'right' ? 'end' : 'start';
        const x = obj.align === 'center' ? (obj.x || 0) + (obj.width || 0) / 2 : obj.x || 0;
        svgContent += `<text x="${x}" y="${(obj.y || 0) + fontSize}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" text-anchor="${textAnchor}" fill="${obj.fill || '#000'}">${obj.text || ''}</text>`;
        break;
      case 'qr':
        // Para QR codes, usar una imagen (el qrData se procesará después con las variables)
        svgContent += `<image x="${obj.x || 0}" y="${obj.y || 0}" width="${obj.width || 150}" height="${obj.height || 150}" href="${obj.qrData || ''}" />`;
        break;
      case 'star':
        // Generar una estrella SVG
        const centerX = obj.x || 0;
        const centerY = obj.y || 0;
        const innerRadius = obj.innerRadius || 30;
        const outerRadius = obj.outerRadius || 50;
        const numPoints = obj.numPoints || 5;
        const opacity = obj.opacity || 1;
        const fill = obj.fill || '#000';

        let points = '';
        for (let i = 0; i < numPoints * 2; i++) {
          const angle = (i * Math.PI) / numPoints;
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const x = centerX + radius * Math.cos(angle - Math.PI / 2);
          const y = centerY + radius * Math.sin(angle - Math.PI / 2);
          points += `${x},${y} `;
        }
        svgContent += `<polygon points="${points.trim()}" fill="${fill}" opacity="${opacity}" />`;
        break;
      default:
        // Para otros tipos, intentar renderizar como rect por defecto
        if (obj.width && obj.height) {
          svgContent += `<rect x="${obj.x || 0}" y="${obj.y || 0}" width="${obj.width}" height="${obj.height}" fill="${obj.fill || 'transparent'}" />`;
        }
    }
  });

  // Crear el HTML completo con SVG
  const html = `
    <div style="width: ${width}px; height: ${height}px; background-color: ${backgroundColor || '#ffffff'}; position: relative; overflow: hidden;">
      <svg width="${width}" height="${height}" style="position: absolute; top: 0; left: 0;">
        ${svgContent}
      </svg>
    </div>
  `.trim();

  return html;
}

/**
 * Convierte certificate.design a display (formato estándar W3C) si existe (migración de estructura anterior)
 * También elimina certificate completo ya que no está en el contexto JSON-LD estándar
 */
function migrateDesignToDisplayHtml(jsonLd: any): any {
  if (!jsonLd || typeof jsonLd !== 'object') {
    return jsonLd;
  }

  const result = JSON.parse(JSON.stringify(jsonLd));

  // Si existe credentialSubject.certificate.design, convertirlo a display (formato estándar)
  if (
    result.credentialSubject?.certificate?.design
  ) {
    const design = result.credentialSubject.certificate.design;
    const displayHtml = canvasToHtml(design);

    if (displayHtml) {
      // Usar formato estándar W3C Verifiable Credentials para display
      result.display = {
        contentMediaType: 'text/html',
        content: displayHtml
      };
    }
  }

  // Migrar displayHtml antiguo a formato display si existe
  if (result.displayHtml && typeof result.displayHtml === 'string' && !result.display) {
    result.display = {
      contentMediaType: 'text/html',
      content: result.displayHtml
    };
    delete result.displayHtml;
  }

  // Eliminar certificate completo de credentialSubject (no está en el contexto JSON-LD estándar)
  // certificate.version, certificate.metadata, certificate.design no son propiedades estándar de Blockcerts
  if (result.credentialSubject?.certificate) {
    delete result.credentialSubject.certificate;
  }

  return result;
}

/**
 * Procesa variables en un objeto JSON, reemplazando tanto {{variable}} como {variable}
 */
export function processVariables(obj: any, variables: Record<string, any>): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    let result = obj;
    // Procesar variables con doble llave {{var}}
    for (const key in variables) {
      const value = variables[key];
      if (value !== undefined && value !== null) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      }
    }
    // Procesar variables con llave simple {var}
    for (const key in variables) {
      const value = variables[key];
      if (value !== undefined && value !== null) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      }
    }
    return result;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => processVariables(item, variables));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = processVariables(obj[key], variables);
    }
    return result;
  }

  return obj;
}

/**
 * Verifica si un string es una IRI absoluta (comienza con http://, https://, did:, mailto:, etc.)
 */
function isAbsoluteIri(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // Verificar si es una IRI absoluta (protocolo conocido)
  return /^(https?|did|mailto|urn|blob|data):/i.test(value);
}

/**
 * Obtiene las variables del issuer desde el template, issuerDid proporcionado, o variables de entorno
 */
function getIssuerVariables(template?: any, issuerDid?: string): Record<string, string> {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  // Prioridad 1: Si se proporciona issuerDid explícitamente, usarlo
  if (issuerDid && isAbsoluteIri(issuerDid)) {
    // Si es un DID, construir la URL del issuer profile
    let issuerProfileUrl = issuerDid;
    if (issuerDid.startsWith('did:web:')) {
      // Extraer el issuerId del DID: did:web:domain:issuers:issuerId
      const parts = issuerDid.split(':');
      const issuerId = parts[parts.length - 1];
      issuerProfileUrl = `${baseUrl}/issuers/${issuerId}/issuer.json`;
    }
    
    return {
      issuerDid: issuerDid, // Usar el DID directamente como issuer.id
      issuerProfileUrl: issuerProfileUrl, // URL del issuer profile para referencia
      issuerName: process.env.ISSUER_NAME || 'Cert Issuer',
      issuerUrl: baseUrl,
      issuerLogo: process.env.ISSUER_LOGO || '',
    };
  }

  // Prioridad 2: Si el template tiene jsonLd con issuer ya definido (sin variables), usarlo
  if (template?.jsonLd?.issuer) {
    const issuer = template.jsonLd.issuer;
    // Si el issuer ya tiene valores concretos (no variables), usarlos
    // PERO solo si el issuer.id es una IRI absoluta válida
    if (
      typeof issuer.id === 'string' &&
      !issuer.id.includes('{') &&
      !issuer.id.includes('{{') &&
      isAbsoluteIri(issuer.id) // Validar que sea una IRI absoluta
    ) {
      return {
        issuerDid: issuer.id,
        issuerProfileUrl: issuer.id.startsWith('did:web:') 
          ? `${baseUrl}/issuers/${issuer.id.split(':').pop()}/issuer.json`
          : issuer.id,
        issuerName: issuer.name || process.env.ISSUER_NAME || 'Cert Issuer',
        issuerUrl: issuer.url || baseUrl,
        issuerLogo: issuer.image || process.env.ISSUER_LOGO || '',
      };
    }
    // Si issuer.id existe pero no es una IRI absoluta (ej: solo UUID), usar fallback
  }

  // Fallback a variables de entorno
  const issuerName = process.env.ISSUER_NAME || 'Cert Issuer';
  const fallbackIssuerDid = `${baseUrl}/issuer.json`;
  const issuerUrl = baseUrl;
  const issuerLogo = process.env.ISSUER_LOGO || '';

  return {
    issuerDid: fallbackIssuerDid,
    issuerProfileUrl: fallbackIssuerDid,
    issuerName,
    issuerUrl,
    issuerLogo,
  };
}

/**
 * Genera un Blockcert desde un template completo con variables
 * @param template Template con jsonLd
 * @param recipient Datos del recipient
 * @param issuerDid DID del issuer (opcional, se usa si está disponible)
 */
export function generateBlockcertFromTemplate(
  template: any,
  recipient: Record<string, any>,
  issuerDid?: string
): any {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const issuanceDate = new Date(recipient.date || recipient.fecha || new Date()).toISOString();

  // Variables del issuer (usar issuerDid si está disponible, luego las del template)
  const issuerVars = getIssuerVariables(template, issuerDid);

  // Variables del recipient (mapeo de nombres alternativos)
  const recipientVars: Record<string, any> = {
    studentName: recipient.studentName || recipient.nombre || recipient.name,
    studentDid: recipient.studentDid || `mailto:${recipient.email || 'test@example.com'}`,
    email: recipient.email || 'test@example.com',
    courseName: recipient.courseName || recipient.curso || recipient.course,
    date: issuanceDate,
    qrUrl: recipient.qrUrl || `${baseUrl}/certificates/${recipient.id || ''}`,
    firmaDigital: '', // Se completa tras el anclaje
  };

  // Combinar todas las variables
  const allVariables = { ...issuerVars, ...recipientVars, ...recipient };

  // Si el template tiene jsonLd completo, usarlo
  if (template.jsonLd && typeof template.jsonLd === 'object') {
    // Primero, migrar certificate.design a displayHtml si existe (para templates antiguos)
    const migratedTemplate = migrateDesignToDisplayHtml(template.jsonLd);

    // Procesar variables en el template migrado
    const processedTemplate = processVariables(migratedTemplate, allVariables);

    // Asegurar compatibilidad Blockcerts: duplicar display en displayHtml (usado por el visor/PDF)
    if (processedTemplate.display?.content && !processedTemplate.displayHtml) {
      processedTemplate.displayHtml = processedTemplate.display.content;
    }

    // Asegurar que issuer.id sea una IRI absoluta válida
    // Preferir usar el DID directamente si está disponible (más estándar)
    if (processedTemplate.issuer && processedTemplate.issuer.id) {
      if (!isAbsoluteIri(processedTemplate.issuer.id)) {
        // Si no es una IRI absoluta, usar el issuerDid de las variables (que siempre es una IRI)
        processedTemplate.issuer.id = issuerVars.issuerDid;
      }
    } else if (processedTemplate.issuer) {
      // Si no tiene id, establecerlo usando el DID si está disponible
      processedTemplate.issuer.id = issuerVars.issuerDid;
    }
    
    // IMPORTANTE: Si issuerDid es un DID (did:web:...), usarlo directamente como issuer.id
    // Esto es más estándar y permite que los verificadores resuelvan el DID Document
    // Si no es un DID, se usará la URL del issuer profile

    // Asegurar que tenga un ID único
    if (!processedTemplate.id) {
      processedTemplate.id = `urn:uuid:${uuidv4()}`;
    }

    // Asegurar que el proof esté configurado correctamente para MerkleProof2019
    if (!processedTemplate.proof) {
      processedTemplate.proof = {};
    }
    processedTemplate.proof.type = 'MerkleProof2019';
    processedTemplate.proof.created = issuanceDate;
    processedTemplate.proof.proofPurpose = 'assertionMethod';
    processedTemplate.proof.verificationMethod = processedTemplate.proof.verificationMethod || `${baseUrl}/issuer.json#key-1`;
    processedTemplate.proof.merkleRoot = '';
    processedTemplate.proof.targetHash = '';
    processedTemplate.proof.proofValue = '';
    processedTemplate.proof.anchors = [];

    // REPARACIÓN AUTOMÁTICA DE PLANTILLAS ANTIGUAS

    // 1. Asegurar que el contexto incluya las definiciones necesarias
    if (processedTemplate['@context']) {
      const context = Array.isArray(processedTemplate['@context'])
        ? processedTemplate['@context']
        : [processedTemplate['@context']];

      // Asegurar blockcerts v3.1 (algunos visores usan v3.1 para display/render)
      if (!context.includes('https://w3id.org/blockcerts/v3.1')) {
        context.push('https://w3id.org/blockcerts/v3.1');
      }

      // Verificar si falta el contexto de Open Badges
      const hasOpenBadges = context.some(c => typeof c === 'string' && c.includes('imsglobal.org/spec/ob'));
      if (!hasOpenBadges) {
        // Insertar antes del último elemento (que suele ser el objeto de definiciones locales)
        if (context.length > 0 && typeof context[context.length - 1] === 'object') {
          context.splice(context.length - 1, 0, 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json');
        } else {
          context.push('https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json');
        }
      }

      // Asegurar definiciones locales para courseName si no existen
      const localDefsIndex = context.findIndex(c => typeof c === 'object');
      if (localDefsIndex >= 0) {
        const localDefs = context[localDefsIndex];
        if (!localDefs.courseName) {
          localDefs.courseName = 'https://schema.org/name';
        }
      } else {
        context.push({
          'courseName': 'https://schema.org/name'
        });
      }

      // Añadir definiciones locales para display/displayHtml (evita unmapped en verificador)
      const localDefsIndex2 = context.findIndex(c => typeof c === 'object');
      if (localDefsIndex2 >= 0) {
        const localDefs = context[localDefsIndex2];
        localDefs.display = localDefs.display || 'https://w3id.org/blockcerts#display';
        localDefs.displayHtml = localDefs.displayHtml || 'https://w3id.org/blockcerts#displayHtml';
        localDefs.content = localDefs.content || 'https://w3id.org/blockcerts#displayContent';
        localDefs.contentMediaType = localDefs.contentMediaType || 'https://w3id.org/blockcerts#displayContentMediaType';
        localDefs.metadata = localDefs.metadata || 'https://schema.org/additionalProperty';
      } else {
        context.push({
          'display': 'https://w3id.org/blockcerts#display',
          'displayHtml': 'https://w3id.org/blockcerts#displayHtml',
          'content': 'https://w3id.org/blockcerts#displayContent',
          'contentMediaType': 'https://w3id.org/blockcerts#displayContentMediaType',
          'metadata': 'https://schema.org/additionalProperty'
        });
      }

      processedTemplate['@context'] = context;
    }

    // Metadatos básicos (usados por el visor oficial para mostrar info del registro)
    if (!processedTemplate.metadata) {
      processedTemplate.metadata = {
        name: `Certificado de ${recipientVars.studentName || 'estudiante'}`,
        description: `Emitido por ${issuerVars.issuerName || 'emisor'} el ${new Date(issuanceDate).toLocaleString()}`
      };
    }

    // 2. Corregir estructura de achievement/courseName
    // Si tiene achievement pero causa error (no es IRI absoluta), moverlo a courseName
    if (processedTemplate.credentialSubject && processedTemplate.credentialSubject.achievement) {
      const achievement = processedTemplate.credentialSubject.achievement;
      // Si achievement es un objeto simple con name, usar ese name como courseName
      if (achievement.name && !processedTemplate.credentialSubject.courseName) {
        processedTemplate.credentialSubject.courseName = achievement.name;
      }
      // Eliminar achievement para evitar error de validación "Dropping property..."
      // ya que el validador estricto requiere que achievement sea una IRI o tenga estructura específica
      delete processedTemplate.credentialSubject.achievement;
    }

    return processedTemplate;
  }

  // Fallback: generar Blockcert básico (compatibilidad con sistema anterior)
  return generateBlockcert({
    recipientName: recipientVars.studentName,
    recipientEmail: recipientVars.email,
    course: recipientVars.courseName,
    date: issuanceDate,
    issuerName: issuerVars.issuerName,
    issuerId: issuerVars.issuerDid,
    issuerPublicKey: '0x1234...abcd',
    appUrl: baseUrl,
  });
}

/**
 * Genera un Blockcert básico (compatibilidad con sistema anterior)
 */
export function generateBlockcert({ recipientName, recipientEmail, course, date, issuerName, issuerId, issuerPublicKey, appUrl }) {
  const issuanceDate = new Date(date).toISOString();
  const baseUrl = appUrl || process.env.APP_URL || 'http://localhost:3000';
  const displayDate = issuanceDate.split('T')[0];
  const logoUrl = 'https://dummyimage.com/150x150/000/fff.png&text=LOGO';
  const displayHtml = `<div style="width: 100%; height: auto; min-height: 850px; background-color: #f0f9ff; overflow: hidden;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="1200" height="8" fill="#0369a1" /><text x="505" y="179" font-family="sans-serif" font-size="48" font-weight="bold" text-anchor="middle" fill="#0369a1">CERTIFICADO DE LOGRO</text><text x="494" y="270" font-family="sans-serif" font-size="20" font-weight="normal" text-anchor="middle" fill="#64748b">Se otorga a</text><text x="520" y="376" font-family="sans-serif" font-size="56" font-weight="bold" text-anchor="middle" fill="#1e293b">${recipientName}</text><text x="576" y="462" font-family="sans-serif" font-size="24" font-weight="normal" text-anchor="middle" fill="#475569">Por completar exitosamente el curso</text><text x="592" y="532" font-family="sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="#0369a1">${course || '[Nombre del Curso]'}</text><text x="606" y="590" font-family="sans-serif" font-size="18" font-weight="normal" text-anchor="middle" fill="#64748b">Fecha: ${displayDate}</text><image x="874" y="628" width="150" height="150" href="${logoUrl}" /><polygon points="150,650 161,672 185,664 177,688 200,700 177,711 185,735 161,727 150,750 138,727 114,735 122,711 100,700 122,688 114,664 138,672" fill="#0369a1" opacity="0.2" /></svg></div>`;
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://w3id.org/blockcerts/v3.1',
      'https://w3id.org/security/suites/secp256k1-2019/v1',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json', // Open Badges v3 para achievement
      {
        'issuanceDate': 'http://www.w3.org/2018/credentials#issuanceDate',
        'RevocationList': 'https://w3id.org/blockcerts#RevocationList',
        'courseName': 'https://schema.org/name',
        'display': 'https://w3id.org/blockcerts#display',
        'displayHtml': 'https://w3id.org/blockcerts#displayHtml',
        'content': 'https://w3id.org/blockcerts#displayContent',
        'contentMediaType': 'https://w3id.org/blockcerts#displayContentMediaType',
        'metadata': 'https://schema.org/additionalProperty'
      }
    ],
    id: `urn:uuid:${uuidv4()}`,
    type: ['VerifiableCredential', 'BlockcertsCredential'],
    issuer: {
      id: issuerId || `${baseUrl}/issuer.json`,
      name: issuerName,
    },
    issuanceDate: issuanceDate,
    credentialSubject: {
      id: `mailto:${recipientEmail}`,
      name: recipientName,
      courseName: course
    },
    metadata: {
      name: `Certificado de ${recipientName}`,
      description: `Emitido por ${issuerName || 'emisor'} el ${displayDate}`
    },
    display: {
      contentMediaType: 'text/html',
      content: displayHtml
    },
    displayHtml: displayHtml,
    proof: {
      type: 'MerkleProof2019',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: `${baseUrl}/issuer.json#key-1`,
      merkleRoot: '', // Se completa tras el anclaje
      targetHash: '', // Se completa tras el anclaje
      proofValue: '', // Se completa tras el anclaje
      anchors: [] // Se completa tras el anclaje
    }
  };
}
