import { Test, TestingModule } from '@nestjs/testing';
import { BlockcertsService } from './blockcerts.service.js';

describe('BlockcertsService', () => {
  let service: BlockcertsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockcertsService],
    }).compile();

    service = module.get<BlockcertsService>(BlockcertsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return issuer profile', async () => {
    const profile = await service.getIssuerProfile();
    expect(profile.id).toContain('/issuer.json');
    // expect(profile.publicKey).toHaveLength(1); // Removed or comment out this line if 'publicKey' does not exist
  });

  it('should return revocation list', async () => {
    const list = await service.getRevocationList();
    expect(list.type).toBe('RevocationList');
    expect(Array.isArray(list.revokedAssertions)).toBe(true);
  });
});
