import { Controller, Delete, Get, HttpCode, HttpStatus, Request, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../tokens/guards';
import { AuthenticatedRequest } from '../../tokens/types/authenticated-request.interface';
import { DevicesService } from '../services/devices.service';
import { DeviceResponseDto } from '../dto';
import { ApiGetDevicesEndpoint, ApiRevokeDeviceEndpoint } from './devices.controller.swagger';

@ApiTags('Auth - User Devices')
@Controller('device')
export class DevicesController {
	constructor(private readonly deviceService: DevicesService) {}

	@Get()
	@UseGuards(JwtAuthGuard)
	@ApiGetDevicesEndpoint()
	async getDevices(@Request() req: AuthenticatedRequest): Promise<DeviceResponseDto[]> {
		return this.deviceService.getUserDevices(req.user.sub);
	}

	@Delete(':deviceId')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiRevokeDeviceEndpoint()
	async revokeDevice(@Request() req: AuthenticatedRequest, @Param('deviceId') deviceId: string) {
		return this.deviceService.revokeDevice(req.user.sub, deviceId);
	}
}
