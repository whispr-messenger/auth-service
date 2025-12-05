import { Test, TestingModule } from '@nestjs/testing'
import { QuickResponseCodeService } from './quick-response-code.service'

describe('QuickResponseCodeService', () => {
    let service: QuickResponseCodeService

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [QuickResponseCodeService],
        }).compile()

        service = module.get<QuickResponseCodeService>(QuickResponseCodeService)
    })

    it('should be defined', () => {
        expect(service).toBeDefined()
    })
})
