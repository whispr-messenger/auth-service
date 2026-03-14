import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwksDocument, JwksService } from './jwks.service';

@ApiTags('Auth - JWKS')
@Controller({ path: 'auth/.well-known', version: VERSION_NEUTRAL })
export class JwksController {
	constructor(private readonly jwksService: JwksService) {}

	@Get('jwks.json')
	@ApiOperation({ summary: 'Return the JSON Web Key Set (JWKS) for ES256 token verification' })
	@ApiResponse({ status: 200, description: 'JWKS document containing the EC public key' })
	getJwks(): JwksDocument {
		return this.jwksService.getJwks();
	}
}
