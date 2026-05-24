import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator'
import { Transform } from 'class-transformer'

export class UserDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  @IsEmail()
  @IsOptional()
  @MaxLength(254)
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
  @MaxLength(128)
  @MinLength(6, {
    message: 'Password must be at least 6 characters long'
  })
  @IsString()
  password?: string
}
