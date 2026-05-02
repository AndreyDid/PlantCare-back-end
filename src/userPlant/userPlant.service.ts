import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from 'src/generated/client'
import { PrismaService } from 'src/prisma.service'
import { UserPlantDto } from './dto/userPlant.dto'
import { UpdateUserPlantDto } from './dto/update-userPlant.dto'

@Injectable()
export class UserPlantService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string) {
    return this.prisma.userPlant.findMany({
      where: {
        userId
      }
    })
  }

  async getById(id: string, userId: string) {
    return this.prisma.userPlant.findFirst({
      where: {
        id,
        userId
      }
    })
  }

  async create(dto: UserPlantDto, userId: string) {
    return this.prisma.userPlant.create({
      data: {
        plantName: dto.plantName,
        plantTypeId: dto.plantTypeId,
        nickname: dto.nickname,
        photoUrl: dto.photoUrl,
        lightLevel: dto.lightLevel,
        temperatureMin: dto.temperatureMin,
        temperatureMax: dto.temperatureMax,
        humidityMin: dto.humidityMin,
        humidityMax: dto.humidityMax,
        potType: dto.potType,
        potSize: dto.potSize,
        soilType: dto.soilType,
        lastRepottedAt: dto.lastRepottedAt,
        nextRepottingAt: dto.nextRepottingAt,
        lastWateredAt: dto.lastWateredAt,
        nextWateringAt: dto.nextWateringAt,
        wateringIntervalDays: dto.wateringIntervalDays,
        wateringIntervalSummerDays: dto.wateringIntervalSummerDays,
        wateringIntervalWinterDays: dto.wateringIntervalWinterDays,
        wateringAmountMl: dto.wateringAmountMl,
        wateringNotes: dto.wateringNotes,
        fertilizingIntervalDays: dto.fertilizingIntervalDays,
        lastFertilizedAt: dto.lastFertilizedAt,
        nextFertilizingAt: dto.nextFertilizingAt,
        userId
      }
    })
  }

  async update(dto: UpdateUserPlantDto, plantId: string, userId: string) {
    const plant = await this.getById(plantId, userId)

    if (!plant) throw new NotFoundException('Plant not found')

    const data: Prisma.UserPlantUncheckedUpdateInput = {}

    if ('plantName' in dto) data.plantName = dto.plantName
    if ('plantTypeId' in dto) data.plantTypeId = dto.plantTypeId
    if ('nickname' in dto) data.nickname = dto.nickname
    if ('photoUrl' in dto) data.photoUrl = dto.photoUrl
    if ('lastWateredAt' in dto) data.lastWateredAt = dto.lastWateredAt
    if ('nextWateringAt' in dto) data.nextWateringAt = dto.nextWateringAt
    if ('wateringIntervalDays' in dto)
      data.wateringIntervalDays = dto.wateringIntervalDays
    if ('wateringIntervalSummerDays' in dto)
      data.wateringIntervalSummerDays = dto.wateringIntervalSummerDays
    if ('wateringIntervalWinterDays' in dto)
      data.wateringIntervalWinterDays = dto.wateringIntervalWinterDays
    if ('lightLevel' in dto) data.lightLevel = dto.lightLevel
    if ('temperatureMin' in dto) data.temperatureMin = dto.temperatureMin
    if ('temperatureMax' in dto) data.temperatureMax = dto.temperatureMax
    if ('humidityMin' in dto) data.humidityMin = dto.humidityMin
    if ('humidityMax' in dto) data.humidityMax = dto.humidityMax
    if ('potType' in dto) data.potType = dto.potType
    if ('potSize' in dto) data.potSize = dto.potSize
    if ('soilType' in dto) data.soilType = dto.soilType
    if ('lastRepottedAt' in dto) data.lastRepottedAt = dto.lastRepottedAt
    if ('nextRepottingAt' in dto) data.nextRepottingAt = dto.nextRepottingAt
    if ('wateringAmountMl' in dto) data.wateringAmountMl = dto.wateringAmountMl
    if ('wateringNotes' in dto) data.wateringNotes = dto.wateringNotes
    if ('fertilizingIntervalDays' in dto)
      data.fertilizingIntervalDays = dto.fertilizingIntervalDays
    if ('lastFertilizedAt' in dto) data.lastFertilizedAt = dto.lastFertilizedAt
    if ('nextFertilizingAt' in dto)
      data.nextFertilizingAt = dto.nextFertilizingAt

    return this.prisma.userPlant.update({
      where: {
        id: plantId
      },
      data
    })
  }

  async delete(plantId: string, userId: string) {
    const plant = await this.getById(plantId, userId)

    if (!plant) throw new NotFoundException('Plant not found')

    return this.prisma.userPlant.delete({
      where: {
        id: plantId
      }
    })
  }
}
