import { PartialType } from '@nestjs/mapped-types'
import { UserPlantDto } from './userPlant.dto'

export class UpdateUserPlantDto extends PartialType(UserPlantDto) {}
