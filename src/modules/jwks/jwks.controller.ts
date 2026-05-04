import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwksDocument, JwksService } from './jwks.service';
import { ApiGetJwksEndpoint } from './jwks.controller.swagger';

@ApiTags('Auth - JWKS')
@Controller({ path: '.well-known', version: VERSION_NEUTRAL })
export class JwksController {
	constructor(private readonly jwksService: JwksService) {}

	@SkipThrottle()
	@Get('jwks.json')
	@ApiGetJwksEndpoint()
	getJwks(): JwksDocument {
		return this.jwksService.getJwks();
	}
}
