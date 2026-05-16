import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator'

export class UserDto {
  @IsEmail()
  @IsOptional()
  email!: string

  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string

  @IsString()
  @IsOptional()
  @MaxLength(120)
  city?: string | null

  @IsArray()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  @IsOptional()
  windowDirections?: string[]

  @IsOptional()
  @MinLength(6, {
    message: 'Password must be at least 6 characters long'
  })
  @IsString()
  password?: string
}
