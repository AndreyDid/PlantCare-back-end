import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator'
import {
  PlantCareEventType,
  plantCareEventTypes
} from './create-plant-care-event.dto'

export class GetPlantCareEventsDto {
  @IsOptional()
  @IsString()
  plantId?: string

  @IsOptional()
  @IsIn(plantCareEventTypes)
  type?: PlantCareEventType

  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @IsOptional()
  @IsDateString()
  dateTo?: string
}
