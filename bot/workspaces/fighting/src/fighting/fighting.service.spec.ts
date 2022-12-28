import { Test, TestingModule } from '@nestjs/testing'
import { FightingInstanceService } from './fighting.service'

describe('FightingService', () => {
	let service: FightingInstanceService

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [FightingInstanceService],
		}).compile()

		service = module.get<FightingInstanceService>(
			FightingInstanceService,
		)
	})

	it('should be defined', () => {
		expect(service).toBeDefined()
	})
})
