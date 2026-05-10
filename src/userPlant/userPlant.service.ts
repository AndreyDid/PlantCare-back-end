import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from 'src/generated/client'
import { PrismaService } from 'src/prisma.service'
import { UserPlantDto } from './dto/userPlant.dto'
import { UpdateUserPlantDto } from './dto/update-userPlant.dto'

@Injectable()
export class UserPlantService {
  constructor(private prisma: PrismaService) {}

  private getPositiveNumber(value?: number | null) {
    return value && value > 0 ? value : null
  }

  private getSeasonByDate(date: Date) {
    const month = date.getUTCMonth()

    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'autumn'

    return 'winter'
  }

  private getSeasonalWateringIntervalDays(
    date: Date,
    plant: Pick<
      Prisma.UserPlantUncheckedUpdateInput,
      | 'wateringIntervalDays'
      | 'wateringIntervalSpringDays'
      | 'wateringIntervalSummerDays'
      | 'wateringIntervalAutumnDays'
      | 'wateringIntervalWinterDays'
    >
  ) {
    const season = this.getSeasonByDate(date)
    const baseInterval = this.getPositiveNumber(
      plant.wateringIntervalDays as number | null
    )

    if (season === 'spring') {
      return (
        this.getPositiveNumber(
          plant.wateringIntervalSpringDays as number | null
        ) ?? baseInterval
      )
    }

    if (season === 'summer') {
      return (
        this.getPositiveNumber(
          plant.wateringIntervalSummerDays as number | null
        ) ?? baseInterval
      )
    }

    if (season === 'autumn') {
      return (
        this.getPositiveNumber(
          plant.wateringIntervalAutumnDays as number | null
        ) ?? baseInterval
      )
    }

    return (
      this.getPositiveNumber(plant.wateringIntervalWinterDays as number | null) ??
      baseInterval
    )
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date)

    nextDate.setUTCDate(nextDate.getUTCDate() + days)

    return nextDate
  }

  private getNextWateringDate(
    wateredAt: Date,
    plant: {
      lastWateredAt: Date | null
      nextWateringAt: Date | null
      wateringIntervalDays: number | null
      wateringIntervalSpringDays: number | null
      wateringIntervalSummerDays: number | null
      wateringIntervalAutumnDays: number | null
      wateringIntervalWinterDays: number | null
    }
  ) {
    const intervalDays = this.getSeasonalWateringIntervalDays(wateredAt, plant)

    if (intervalDays) return this.addDays(wateredAt, intervalDays)

    if (!plant.nextWateringAt) return null

    if (!plant.lastWateredAt) {
      return plant.nextWateringAt > wateredAt ? plant.nextWateringAt : null
    }

    if (plant.nextWateringAt <= plant.lastWateredAt) {
      return plant.nextWateringAt > wateredAt ? plant.nextWateringAt : null
    }

    return new Date(
      wateredAt.getTime() +
        (plant.nextWateringAt.getTime() - plant.lastWateredAt.getTime())
    )
  }

  private getDayRange(date = new Date()) {
    const startOfToday = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )
    const startOfTomorrow = new Date(startOfToday)
    const startOfDayAfterTomorrow = new Date(startOfToday)

    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
    startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 2)

    return {
      startOfToday,
      startOfTomorrow,
      startOfDayAfterTomorrow
    }
  }

  private async waterPlants(
    userId: string,
    where: Prisma.UserPlantWhereInput
  ) {
    const wateredAt = new Date()
    const plants = await this.prisma.userPlant.findMany({
      where: {
        ...where,
        userId
      }
    })

    if (!plants.length) return []

    return this.prisma.$transaction(
      plants.map(plant =>
        this.prisma.userPlant.update({
          where: {
            id: plant.id
          },
          data: {
            lastWateredAt: wateredAt,
            nextWateringAt: this.getNextWateringDate(wateredAt, plant)
          }
        })
      )
    )
  }

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

  async getWateringOverview(userId: string) {
    const { startOfTomorrow, startOfDayAfterTomorrow } = this.getDayRange()

    const [dueToday, dueTomorrow] = await this.prisma.$transaction([
      this.prisma.userPlant.findMany({
        where: {
          userId,
          nextWateringAt: {
            lt: startOfTomorrow
          }
        },
        orderBy: {
          nextWateringAt: 'asc'
        }
      }),
      this.prisma.userPlant.findMany({
        where: {
          userId,
          nextWateringAt: {
            gte: startOfTomorrow,
            lt: startOfDayAfterTomorrow
          }
        },
        orderBy: {
          nextWateringAt: 'asc'
        }
      })
    ])

    return {
      dueToday,
      dueTomorrow
    }
  }

  async waterAll(userId: string) {
    return this.waterPlants(userId, {})
  }

  async waterDueToday(userId: string) {
    const { startOfTomorrow } = this.getDayRange()

    return this.waterPlants(userId, {
      nextWateringAt: {
        lt: startOfTomorrow
      }
    })
  }

  async waterSelected(userId: string, plantIds: string[]) {
    const uniquePlantIds = Array.from(new Set(plantIds))

    if (!uniquePlantIds.length) return []

    return this.waterPlants(userId, {
      id: {
        in: uniquePlantIds
      }
    })
  }

  async create(dto: UserPlantDto, userId: string) {
    return this.prisma.userPlant.create({
      data: {
        plantName: dto.plantName,
        plantTypeId: dto.plantTypeId,
        nickname: dto.nickname,
        location: dto.location,
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
        wateringIntervalSpringDays: dto.wateringIntervalSpringDays,
        wateringIntervalSummerDays: dto.wateringIntervalSummerDays,
        wateringIntervalAutumnDays: dto.wateringIntervalAutumnDays,
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
    if ('location' in dto) data.location = dto.location
    if ('photoUrl' in dto) data.photoUrl = dto.photoUrl
    if ('lastWateredAt' in dto) data.lastWateredAt = dto.lastWateredAt
    if ('nextWateringAt' in dto) data.nextWateringAt = dto.nextWateringAt
    if ('wateringIntervalDays' in dto)
      data.wateringIntervalDays = dto.wateringIntervalDays
    if ('wateringIntervalSpringDays' in dto)
      data.wateringIntervalSpringDays = dto.wateringIntervalSpringDays
    if ('wateringIntervalSummerDays' in dto)
      data.wateringIntervalSummerDays = dto.wateringIntervalSummerDays
    if ('wateringIntervalAutumnDays' in dto)
      data.wateringIntervalAutumnDays = dto.wateringIntervalAutumnDays
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
