import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator'

export const WINDOW_DIRECTIONS = ['north', 'east', 'south', 'west'] as const

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
  @IsIn(WINDOW_DIRECTIONS, { each: true })
  @IsOptional()
  windowDirections?: string[]

  @IsOptional()
  @MinLength(6, {
    message: 'Password must be at least 6 characters long'
  })
  @IsString()
  password?: string
}
