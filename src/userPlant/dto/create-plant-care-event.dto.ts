import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator'

export const plantCareEventTypes = [
  'WATERING',
  'FERTILIZING',
  'REPOTTING',
  'OBSERVATION',
  'NOTE'
] as const

export type PlantCareEventType = (typeof plantCareEventTypes)[number]

export class CreatePlantCareEventDto {
  @IsIn(plantCareEventTypes)
  type!: PlantCareEventType

  @IsOptional()
  @IsString()
  title?: string | null

  @IsOptional()
  @IsString()
  description?: string | null

  @IsOptional()
  @IsDateString()
  eventAt?: string | null

  @IsOptional()
  @IsInt()
  @Min(1)
  amountMl?: number | null
}
