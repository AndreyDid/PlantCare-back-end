import { PartialType } from '@nestjs/mapped-types'
import { CreatePlantCareEventDto } from './create-plant-care-event.dto'

export class UpdatePlantCareEventDto extends PartialType(
  CreatePlantCareEventDto
) {}
