import { IsOptional, IsString } from 'class-validator'

export class UserPlantDto {
  @IsOptional()
  @IsString()
  plantTypeId?: string

  @IsOptional()
  @IsString()
  plantName?: string

  @IsOptional()
  @IsString()
  nickname?: string

  @IsOptional()
  @IsString()
  photoUrl?: string
}
