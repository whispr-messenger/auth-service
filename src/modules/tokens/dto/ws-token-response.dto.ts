import { ApiProperty } from '@nestjs/swagger';

export class WsTokenResponseDto {
	@ApiProperty({
		description: 'Short-lived JWT (60 s) signed with aud=ws, to use only as the WebSocket query token',
		example:
			'eyJhbGciOiJFUzI1NiIsImtpZCI6IjF9.eyJzdWIiOiJ1c2VyLWlkIiwiYXVkIjoid3MiLCJleHAiOjE3MzAwMDAwNjB9.sig',
		type: String,
	})
	wsToken: string;

	@ApiProperty({
		description: 'Lifetime in seconds (matches the exp claim of wsToken)',
		example: 60,
		type: Number,
	})
	expiresIn: number;
}
