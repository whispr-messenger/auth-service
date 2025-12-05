import { Test, TestingModule } from '@nestjs/testing'
import { BackupCodesService } from './backup-codes.service'

describe('BackupCodesService', () => {
    let service: BackupCodesService

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [BackupCodesService],
        }).compile()

        service = module.get<BackupCodesService>(BackupCodesService)
    })

    it('should be defined', () => {
        expect(service).toBeDefined()
    })
})
