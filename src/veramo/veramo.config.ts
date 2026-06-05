import { createAgent, IResolver, IIdentifier, IKeyManager, ICredentialPlugin } from '@veramo/core';
import { DIDManager, MemoryDIDStore } from '@veramo/did-manager';
import { KeyManager, MemoryKeyStore, MemoryPrivateKeyStore } from '@veramo/key-manager';
import { KeyManagementSystem } from '@veramo/kms-local';
import { CredentialPlugin } from '@veramo/credential-w3c';
import { WebDIDProvider } from '@veramo/did-provider-web';
import { KeyDIDProvider } from '@veramo/did-provider-key';

/**
 * Configuración del Veramo Agent
 * 
 * Este agent maneja:
 * - DIDs (did:web, did:key)
 * - Gestión de claves
 * - Firma de credenciales (JSON-LD)
 * - Verificación de credenciales
 * 
 * NOTA: CredentialIssuerLD se carga de forma lazy para evitar problemas con import assertions
 * en Node.js. Se carga solo cuando se necesita firmar credenciales, NO al crear DIDs.
 */
let veramoAgentInstance: ReturnType<typeof createAgent<IResolver & IIdentifier & IKeyManager & ICredentialPlugin>> | null = null;
let credentialLdPlugin: any = null;

/**
 * Crea el Veramo Agent básico (sin CredentialIssuerLD)
 * Esto permite crear DIDs sin cargar @veramo/credential-ld
 */
function createBasicVeramoAgent() {
  return createAgent<IResolver & IIdentifier & IKeyManager & ICredentialPlugin>({
    plugins: [
      // Key Management (debe ir primero)
      new KeyManager({
        store: new MemoryKeyStore(),
        kms: {
          local: new KeyManagementSystem(new MemoryPrivateKeyStore()),
        },
      }),
      
      // DID Management
      new DIDManager({
        store: new MemoryDIDStore(),
        defaultProvider: 'did:web',
        providers: {
          'did:web': new WebDIDProvider({
            defaultKms: 'local',
          }),
          'did:key': new KeyDIDProvider({
            defaultKms: 'local',
          }),
        },
      }),
      
      // Credential Plugin (W3C)
      // NOTA: No usamos DIDResolverPlugin porque construimos el DID Document manualmente
      // desde el IIdentifier retornado por didManagerGet
      new CredentialPlugin(),
    ],
  });
}

/**
 * Carga CredentialIssuerLD de forma lazy solo cuando se necesita
 */
async function loadCredentialLdPlugin() {
  if (!credentialLdPlugin) {
    try {
      // Intentar cargar el módulo dinámicamente
      const credentialLdModule = await import('@veramo/credential-ld');
      const { CredentialIssuerLD, VeramoEd25519Signature2020 } = credentialLdModule;
      
      credentialLdPlugin = new CredentialIssuerLD({
        contextMaps: [],
        suites: [new VeramoEd25519Signature2020()],
      });
    } catch (error) {
      // Si falla el import, lanzar error más descriptivo
      throw new Error(
        `Failed to load @veramo/credential-ld. This is required for signing credentials. ` +
        `Error: ${error.message}. ` +
        `Make sure Node.js version supports dynamic imports or update the package.`
      );
    }
  }
  return credentialLdPlugin;
}

/**
 * Obtiene el Veramo Agent, cargándolo de forma lazy si es necesario.
 * CredentialIssuerLD solo se carga cuando se necesita firmar credenciales.
 */
export async function getVeramoAgent(requireCredentialLd: boolean = false) {
  if (!veramoAgentInstance) {
    // Crear agent básico sin CredentialIssuerLD
    veramoAgentInstance = createBasicVeramoAgent();
  }
  
  // Solo cargar CredentialIssuerLD si se necesita
  if (requireCredentialLd && !credentialLdPlugin) {
    const plugin = await loadCredentialLdPlugin();
    // Agregar el plugin al agent si es posible
    // Nota: Veramo no permite agregar plugins después de crear el agent,
    // así que necesitamos recrearlo con el plugin incluido
    veramoAgentInstance = createAgent<IResolver & IIdentifier & IKeyManager & ICredentialPlugin>({
      plugins: [
        new KeyManager({
          store: new MemoryKeyStore(),
          kms: {
            local: new KeyManagementSystem(new MemoryPrivateKeyStore()),
          },
        }),
        new DIDManager({
          store: new MemoryDIDStore(),
          defaultProvider: 'did:web',
          providers: {
            'did:web': new WebDIDProvider({
              defaultKms: 'local',
            }),
            'did:key': new KeyDIDProvider({
              defaultKms: 'local',
            }),
          },
        }),
        // NOTA: No usamos DIDResolverPlugin porque construimos el DID Document manualmente
        new CredentialPlugin(),
        plugin, // Agregar CredentialIssuerLD
      ],
    });
    credentialLdPlugin = plugin;
  }
  
  return veramoAgentInstance;
}
