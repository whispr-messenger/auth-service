import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PreKeyDto {
	@IsNumber()
	keyId: number;

	@IsString()
	publicKey: string;
}

export class SignedPreKeyDto {
	@IsNumber()
	keyId: number;

	@IsString()
	publicKey: string;

	@IsString()
	signature: string;
}

export class SignalKeyBundleDto {
	@IsString()
	identityKey: string;

	@ValidateNested()
	@Type(() => SignedPreKeyDto)
	signedPreKey: SignedPreKeyDto;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PreKeyDto)
	preKeys: PreKeyDto[];
}
