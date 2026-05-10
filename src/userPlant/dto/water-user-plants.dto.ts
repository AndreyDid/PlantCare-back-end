import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

export class WaterUserPlantsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  plantIds!: string[]
}
