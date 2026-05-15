import { IsString, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const PG_INT32_MAX = 2147483647;

export class PreKeyDto {
	@ApiProperty({ description: 'Pre-key identifier', example: 1 })
	@IsInt()
	@Min(0)
	@Max(PG_INT32_MAX)
	keyId: number;

	@ApiProperty({ description: 'Base64-encoded public key', example: 'BQ3Nc6BHnBm...' })
	@IsString()
	publicKey: string;
}

export class SignedPreKeyDto {
	@ApiProperty({ description: 'Signed pre-key identifier', example: 1 })
	@IsInt()
	@Min(0)
	@Max(PG_INT32_MAX)
	keyId: number;

	@ApiProperty({ description: 'Base64-encoded public key', example: 'BQ3Nc6BHnBm...' })
	@IsString()
	publicKey: string;

	@ApiProperty({ description: 'Base64-encoded signature', example: 'aW52YWxpZC...' })
	@IsString()
	signature: string;
}

export class SignalKeyBundleDto {
	@ApiProperty({ description: 'Base64-encoded identity key', example: 'BQ3Nc6BHnBm...' })
	@IsString()
	identityKey: string;

	@ApiProperty({ description: 'Signed pre-key', type: SignedPreKeyDto })
	@ValidateNested()
	@Type(() => SignedPreKeyDto)
	signedPreKey: SignedPreKeyDto;

	@ApiProperty({ description: 'Array of one-time pre-keys', type: [PreKeyDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PreKeyDto)
	preKeys: PreKeyDto[];
}
