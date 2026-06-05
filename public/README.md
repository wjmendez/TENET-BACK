# Verificador de Certificados Blockcerts

Este directorio contiene el verificador web de certificados Blockcerts.

## Acceso

Una vez que el servidor esté corriendo, accede al verificador en:

**http://localhost:3100/verifier.html**

## Características

El verificador permite verificar certificados Blockcerts de tres formas:

1. **Desde URL**: Ingresa el ID del certificado o credentialUuid para cargarlo directamente desde el backend
2. **Pegar JSON**: Pega el JSON completo del certificado
3. **Subir Archivo**: Selecciona un archivo JSON del certificado desde tu computadora

## Uso

### Opción 1: Desde URL (Recomendado)

1. Abre el verificador en tu navegador
2. Selecciona la pestaña "Desde URL"
3. Ingresa el ID del certificado o el credentialUuid
   - Ejemplo de ID: `042dad16-ba5d-4887-a4b0-024e783281ed`
   - Ejemplo de UUID: `3236f211-4e15-4318-81a4-4dd8e9ed1143`
4. Haz clic en "Cargar y Verificar"

### Opción 2: Pegar JSON

1. Obtén el JSON del certificado usando:
   ```bash
   curl -X GET "http://localhost:3100/certificates/{ID}/blockcerts" \
     -H "accept: application/json" > certificado.json
   ```
2. Abre el archivo y copia su contenido
3. Pega el JSON en el verificador
4. Haz clic en "Verificar"

### Opción 3: Subir Archivo

1. Descarga el JSON del certificado
2. Selecciona el archivo en el verificador
3. Haz clic en "Cargar y Verificar"

## Resultado de la Verificación

El verificador mostrará:

- ✅ **Estado de verificación**: Si el certificado es válido o no
- 📜 **Información del certificado**: ID, emisor, destinatario, fecha, etc.
- 🎨 **Vista previa**: Renderizado visual del certificado (si tiene `displayHtml`)
- 🔗 **Anclaje blockchain**: Información sobre el anclaje a blockchain

## Requisitos

- El certificado debe estar en estado `ISSUED` y tener un anclaje confirmado
- El certificado debe tener un `proof` válido con anclaje a blockchain
- El backend debe estar corriendo y accesible

## Solución de Problemas

### Error: "Blockcerts Verifier no está cargado"
- Recarga la página
- Verifica tu conexión a internet (el verificador se carga desde CDN)

### Error: "Error al cargar certificado"
- Verifica que el ID del certificado sea correcto
- Verifica que el certificado esté en estado `ISSUED`
- Verifica que el certificado tenga un anclaje confirmado

### Error: "Verificación Fallida"
- Verifica que el certificado tenga un `proof` válido
- Verifica que el anclaje a blockchain sea correcto
- Verifica que el issuer profile sea accesible

