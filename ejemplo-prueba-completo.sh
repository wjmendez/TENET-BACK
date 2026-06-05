#!/bin/bash

# Script de ejemplo para probar todos los endpoints del sistema
# Base URL
BASE_URL="http://localhost:3100"

echo "🚀 Iniciando pruebas completas del sistema..."
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir secciones
print_section() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Función para hacer requests y mostrar resultados
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}▶ $description${NC}"
    echo "  $method $endpoint"
    
    if [ -n "$data" ]; then
        echo "  Body: $data"
        response=$(curl -s -X "$method" \
            "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -X "$method" \
            "$BASE_URL$endpoint")
    fi
    
    echo -e "${GREEN}✓ Respuesta:${NC}"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    
    # Retornar la respuesta para extraer IDs
    echo "$response"
}

# ============================================
# 1. HEALTH CHECK
# ============================================
print_section "1. HEALTH CHECK"
health=$(make_request "GET" "/" "" "Verificar que la API está funcionando")

# ============================================
# 2. CREAR VERTICAL
# ============================================
print_section "2. CREAR VERTICAL (EdTech)"
vertical_data='{
  "name": "EdTech",
  "slug": "edtech",
  "description": "Educación - Certificados académicos",
  "config": {
    "blockchain": "besu",
    "privacyLevel": "public",
    "didMethod": "did:web",
    "features": ["bundle", "open_badges"]
  },
  "isActive": true
}'
vertical_response=$(make_request "POST" "/verticals" "$vertical_data" "Crear vertical EdTech")
VERTICAL_ID=$(echo "$vertical_response" | jq -r '.id' 2>/dev/null)
echo -e "${GREEN}✓ Vertical ID guardado: $VERTICAL_ID${NC}"

# ============================================
# 3. CREAR ISSUER
# ============================================
print_section "3. CREAR ISSUER (DID se genera automáticamente)"
issuer_data='{
  "name": "Universidad Ejemplo",
  "url": "https://universidad-ejemplo.com",
  "logo": "https://universidad-ejemplo.com/logo.png"
}'
issuer_response=$(make_request "POST" "/issuers" "$issuer_data" "Crear issuer (DID automático)")
ISSUER_ID=$(echo "$issuer_response" | jq -r '.id' 2>/dev/null)
ISSUER_DID=$(echo "$issuer_response" | jq -r '.did' 2>/dev/null)
echo -e "${GREEN}✓ Issuer ID: $ISSUER_ID${NC}"
echo -e "${GREEN}✓ Issuer DID: $ISSUER_DID${NC}"

# ============================================
# 4. OBTENER DID DOCUMENT
# ============================================
print_section "4. OBTENER DID DOCUMENT"
make_request "GET" "/issuers/$ISSUER_ID/did.json" "" "Obtener DID Document (W3C DID Core)"

# ============================================
# 5. CREAR TEMPLATE
# ============================================
print_section "5. CREAR TEMPLATE"
template_data='{
  "name": "Diploma Universitario",
  "description": "Template para diplomas universitarios",
  "jsonLd": {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/blockcerts/v3.1",
      {
        "display": "https://w3id.org/blockcerts#display",
        "displayHtml": "https://w3id.org/blockcerts#displayHtml"
      }
    ],
    "type": ["VerifiableCredential", "BlockcertsCredential"],
    "issuer": {
      "id": "{issuerDid}",
      "name": "{issuerName}"
    },
    "issuanceDate": "{{date}}",
    "credentialSubject": {
      "id": "mailto:{{email}}",
      "name": "{{studentName}}",
      "courseName": "{{courseName}}",
      "certificate": {
        "design": {
          "type": "canvas",
          "elements": [
            {
              "type": "text",
              "content": "CERTIFICADO DE LOGRO",
              "x": 600,
              "y": 100,
              "fontSize": 48,
              "fontWeight": "bold",
              "color": "#0369a1"
            },
            {
              "type": "text",
              "content": "{{studentName}}",
              "x": 600,
              "y": 300,
              "fontSize": 56,
              "fontWeight": "bold",
              "color": "#1e293b"
            },
            {
              "type": "text",
              "content": "{{courseName}}",
              "x": 600,
              "y": 470,
              "fontSize": 32,
              "fontWeight": "bold",
              "color": "#0369a1"
            }
          ]
        }
      }
    },
    "display": {
      "contentMediaType": "text/html",
      "content": "<div style=\"width: 100%; height: auto; min-height: 850px; background-color: #f0f9ff; overflow: hidden;\"><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1200 850\" width=\"100%\" height=\"100%\" preserveAspectRatio=\"xMidYMid meet\"><rect x=\"0\" y=\"0\" width=\"1200\" height=\"8\" fill=\"#0369a1\" /><text x=\"505\" y=\"179\" font-family=\"sans-serif\" font-size=\"48\" font-weight=\"bold\" text-anchor=\"middle\" fill=\"#0369a1\">CERTIFICADO DE LOGRO</text><text x=\"520\" y=\"376\" font-family=\"sans-serif\" font-size=\"56\" font-weight=\"bold\" text-anchor=\"middle\" fill=\"#1e293b\">{{studentName}}</text><text x=\"592\" y=\"532\" font-family=\"sans-serif\" font-size=\"32\" font-weight=\"bold\" text-anchor=\"middle\" fill=\"#0369a1\">{{courseName}}</text></svg></div>"
    }
  }
}'
template_response=$(make_request "POST" "/templates" "$template_data" "Crear template")
TEMPLATE_ID=$(echo "$template_response" | jq -r '.id' 2>/dev/null)
echo -e "${GREEN}✓ Template ID: $TEMPLATE_ID${NC}"

# ============================================
# 6. EMITIR CREDENCIAL
# ============================================
print_section "6. EMITIR CREDENCIAL"
credential_data="{
  \"verticalId\": \"$VERTICAL_ID\",
  \"templateId\": \"$TEMPLATE_ID\",
  \"issuerDid\": \"$ISSUER_DID\",
  \"recipientData\": {
    \"studentName\": \"Juan Pérez\",
    \"email\": \"juan@example.com\",
    \"courseName\": \"Ingeniería de Software\"
  }
}"
credential_response=$(make_request "POST" "/credentials/issue" "$credential_data" "Emitir credencial")
CERTIFICATE_ID=$(echo "$credential_response" | jq -r '.[0].id' 2>/dev/null)
echo -e "${GREEN}✓ Certificate ID: $CERTIFICATE_ID${NC}"

# ============================================
# 7. LISTAR CREDENCIALES
# ============================================
print_section "7. LISTAR CREDENCIALES"
make_request "GET" "/credentials" "" "Listar todas las credenciales"
make_request "GET" "/credentials?verticalId=$VERTICAL_ID" "" "Listar credenciales de la vertical"

# ============================================
# 8. ANCLAR CERTIFICADO
# ============================================
print_section "8. ANCLAR CERTIFICADO A BLOCKCHAIN"
anchor_data="{
  \"certificateIds\": [\"$CERTIFICATE_ID\"],
  \"blockchain\": \"besu\"
}"
anchor_response=$(make_request "POST" "/anchors/approve" "$anchor_data" "Anclar certificado a blockchain")
echo -e "${YELLOW}⚠ Nota: Si no tienes Besu configurado, usa 'mocknet' en lugar de 'besu'${NC}"

# ============================================
# 9. OBTENER CREDENCIAL BLOCKCERTS
# ============================================
print_section "9. OBTENER CREDENCIAL EN FORMATO BLOCKCERTS"
make_request "GET" "/credentials/$CERTIFICATE_ID/blockcerts" "" "Obtener credencial Blockcerts (requiere anclaje)"

# ============================================
# 10. LISTAR CREDENCIALES DE VERTICAL
# ============================================
print_section "10. LISTAR CREDENCIALES DE VERTICAL"
make_request "GET" "/verticals/edtech/credentials" "" "Listar credenciales de vertical EdTech"

# ============================================
# RESUMEN
# ============================================
print_section "✅ RESUMEN DE PRUEBAS"
echo -e "${GREEN}✓ Vertical ID: $VERTICAL_ID${NC}"
echo -e "${GREEN}✓ Issuer ID: $ISSUER_ID${NC}"
echo -e "${GREEN}✓ Issuer DID: $ISSUER_DID${NC}"
echo -e "${GREEN}✓ Template ID: $TEMPLATE_ID${NC}"
echo -e "${GREEN}✓ Certificate ID: $CERTIFICATE_ID${NC}"
echo ""
echo -e "${BLUE}📚 Swagger UI: $BASE_URL/docs${NC}"
echo -e "${BLUE}🔐 Blockcerts Verifier: $BASE_URL/verifier.html${NC}"
echo ""
echo "✅ Pruebas completadas!"







