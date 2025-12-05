import { Test, TestingModule } from '@nestjs/testing'
import { QuickResponseCodeController } from './quick-response-code.controller'

describe('QuickResponseCodeController', () => {
    let controller: QuickResponseCodeController

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [QuickResponseCodeController],
        }).compile()

        controller = module.get<QuickResponseCodeController>(
            QuickResponseCodeController
        )
    })

    it('should be defined', () => {
        expect(controller).toBeDefined()
    })
})
