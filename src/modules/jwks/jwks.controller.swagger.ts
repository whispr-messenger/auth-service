import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export const ApiGetJwksEndpoint = () =>
	applyDecorators(
		ApiOperation({ summary: 'Return the JSON Web Key Set (JWKS) for ES256 token verification' }),
		ApiResponse({ status: 200, description: 'JWKS document containing the EC public key' })
	);
