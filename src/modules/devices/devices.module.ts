import { Module } from '@nestjs/common'
import { DevicesController } from './devices.controller'
import { DevicesService } from './devices.service'
import { QuickResponseCodeService } from './quick-response-code/quick-response-code.service'
import { QuickResponseCodeController } from './quick-response-code/quick-response-code.controller'

@Module({
    controllers: [DevicesController, QuickResponseCodeController],
    providers: [DevicesService, QuickResponseCodeService],
    exports: [DevicesService],
})
export class DevicesModule {}
