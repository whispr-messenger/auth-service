import { IsString, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const PG_INT32_MAX = 2147483647;

export class PreKeyDto {
	@ApiProperty({ description: 'One-time prekey identifier', example: 1 })
	@IsInt()
	@Min(0)
	@Max(PG_INT32_MAX)
	keyId: number;

	@ApiProperty({ description: 'Base64-encoded public key', example: 'BZrt9...def456' })
	@IsString()
	publicKey: string;
}

export class SignedPreKeyDto {
	@ApiProperty({ description: 'Signed prekey identifier', example: 1 })
	@IsInt()
	@Min(0)
	@Max(PG_INT32_MAX)
	keyId: number;

	@ApiProperty({ description: 'Base64-encoded public key', example: 'BQXm8...abc123' })
	@IsString()
	publicKey: string;

	@ApiProperty({ description: 'Base64-encoded signature of the public key', example: 'SGVsbG8...xyz789' })
	@IsString()
	signature: string;
}

export class SignalKeyBundleDto {
	@ApiProperty({
		description: "Device's long-term identity key (base64-encoded public key)",
		example: 'BRjK5...ghi789',
	})
	@IsString()
	identityKey: string;

	@ApiProperty({
		description: 'Current signed prekey with signature (used for forward secrecy)',
		type: SignedPreKeyDto,
	})
	@ValidateNested()
	@Type(() => SignedPreKeyDto)
	signedPreKey: SignedPreKeyDto;

	@ApiProperty({
		description: 'Batch of one-time prekeys (typically 100 keys). Each key can only be used once.',
		type: [PreKeyDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PreKeyDto)
	preKeys: PreKeyDto[];
}
