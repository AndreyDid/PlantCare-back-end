import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength
} from 'class-validator'

export class AuthDto {
  @IsEmail()
  email!: string

  @MinLength(6, {
    message: 'Password must be at least 6 characters long'
  })
  @IsString()
  password!: string

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean
}
