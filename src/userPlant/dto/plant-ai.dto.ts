import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator'

export class SuggestPlantCareDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  plantName!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null

  @IsOptional()
  @IsObject()
  currentValues?: Record<string, unknown>
}

export class ExistingPlantAiDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(800)
  question?: string | null
}
