import { IsPhoneNumber, IsNotEmpty } from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export class RegisterVerifyRequestDto {
    @ApiProperty({
        description: 'Phone number in E.164 format for registration',
        example: '+33612345678',
        type: String,
    })
    @IsNotEmpty()
    @IsPhoneNumber(undefined, { message: 'Phone number must be valid' })
    @Transform(({ value }) => value?.trim())
    phoneNumber: string
}
