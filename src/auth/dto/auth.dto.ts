import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator'
import { Transform } from 'class-transformer'

export class AuthDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  @IsEmail()
  @MaxLength(254)
  email!: string

  @MaxLength(128)
  @MinLength(6, {
    message: 'Password must be at least 6 characters long'
  })
  @IsString()
  password!: string

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean
}
