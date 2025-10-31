export interface IssuerProfile {
  '@context': (string | Record<string, string>)[];
  id: string;
  type: string;
  name: string;
  url: string;
  publicKey: Array<{
    id: string;
    created?: string;
    revoked?: string;
    expires?: string;
  }>;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyJwk: {
      kty: string;
      crv: string;
      x: string;
      y: string;
      kid: string;
    };
  }>;
  assertionMethod: string;
  revocationList: string;
}

export interface RevocationList {
  id: string;
  type: 'RevocationList';
  issuer: string;
  revokedAssertions: Array<{
    id: string;
    revocationReason: string;
    revokedOn: string;
  }>;
}
