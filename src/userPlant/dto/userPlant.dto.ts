import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from 'class-validator'

export class UserPlantDto {
  @IsOptional()
  @IsString()
  plantTypeId?: string | null

  @IsOptional()
  @IsString()
  plantName?: string

  @IsOptional()
  @IsString()
  nickname?: string

  @IsOptional()
  @IsString()
  location?: string | null

  @IsOptional()
  @IsString()
  photoUrl?: string | null

  @IsOptional()
  @IsString()
  lightLevel?: string | null // свет яркий рассеянный, полутень, тень, прямое солнце.

  @IsOptional()
  @IsNumber()
  temperatureMin?: number | null // температура минимальная

  @IsOptional()
  @IsNumber()
  temperatureMax?: number | null // температура максимальная

  @IsOptional()
  @IsNumber()
  humidityMin?: number | null // влажность минимальная

  @IsOptional()
  @IsNumber()
  humidityMax?: number | null // влажность максимальная

  @IsOptional()
  @IsString()
  potType?: string | null // тип горшка

  @IsOptional()
  @IsString()
  potSize?: string | null // размер горшка

  @IsOptional()
  @IsString()
  soilType?: string | null // тип грунта

  @IsOptional()
  @IsDateString()
  lastRepottedAt?: string | null // последняя пересадка

  @IsOptional()
  @IsDateString()
  nextRepottingAt?: string | null // плановая пересадка

  @IsOptional()
  @IsDateString()
  lastWateredAt?: string | null // последний полив

  @IsOptional()
  @IsDateString()
  nextWateringAt?: string | null // следующий полив

  @IsOptional()
  @IsInt()
  @Min(1)
  wateringIntervalDays?: number | null // базовый интервал полива

  @IsOptional()
  @IsInt()
  @Min(1)
  wateringIntervalSpringDays?: number | null // весенний интервал полива

  @IsOptional()
  @IsInt()
  @Min(1)
  wateringIntervalSummerDays?: number | null // летний интервал полива

  @IsOptional()
  @IsInt()
  @Min(1)
  wateringIntervalAutumnDays?: number | null // осенний интервал полива

  @IsOptional()
  @IsInt()
  @Min(1)
  wateringIntervalWinterDays?: number | null // зимний интервал полива

  @IsOptional()
  @IsNumber()
  wateringAmountMl?: number | null // объем воды

  @IsOptional()
  @IsString()
  wateringNotes?: string | null // заметка по поливу

  @IsOptional()
  @IsNumber()
  fertilizingIntervalDays?: number | null // частота подкормки

  @IsOptional()
  @IsDateString()
  lastFertilizedAt?: string | null // последняя подкормка

  @IsOptional()
  @IsDateString()
  nextFertilizingAt?: string | null // следующая подкормка
}
