import { Test, TestingModule } from '@nestjs/testing';
import { FsService } from './fs.service';

describe('FsService', () => {
  let service: FsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FsService],
    }).compile();

    service = module.get<FsService>(FsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
