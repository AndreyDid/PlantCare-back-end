import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from 'src/generated/client'
import { PrismaService } from 'src/prisma.service'
import {
  CreatePlantCareEventDto,
  PlantCareEventType
} from './dto/create-plant-care-event.dto'
import { GetPlantCareEventsDto } from './dto/get-plant-care-events.dto'
import { UserPlantDto } from './dto/userPlant.dto'
import { UpdateUserPlantDto } from './dto/update-userPlant.dto'
import { CurrentWeatherSummary, WeatherService } from './weather.service'

type WeatherWateringTone = 'normal' | 'attention' | 'caution'

type WeatherWateringAdvice = {
  tone: WeatherWateringTone
  title: string
  text: string
  details: string[]
}

@Injectable()
export class UserPlantService {
  constructor(
    private prisma: PrismaService,
    private readonly weatherService: WeatherService
  ) {}

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
      this.getPositiveNumber(
        plant.wateringIntervalWinterDays as number | null
      ) ?? baseInterval
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

  private getNextFertilizingDate(
    fertilizedAt: Date,
    plant: {
      fertilizingIntervalDays: number | null
    }
  ) {
    const intervalDays = this.getPositiveNumber(plant.fertilizingIntervalDays)

    return intervalDays ? this.addDays(fertilizedAt, intervalDays) : null
  }

  private getCareEventTitle(type: PlantCareEventType) {
    if (type === 'WATERING') return 'Полив'
    if (type === 'FERTILIZING') return 'Подкормка'
    if (type === 'REPOTTING') return 'Пересадка'
    if (type === 'OBSERVATION') return 'Наблюдение'

    return 'Заметка'
  }

  private getCareEventOrderBy(): Prisma.PlantCareEventOrderByWithRelationInput[] {
    return [
      {
        eventAt: 'desc'
      },
      {
        createdAt: 'desc'
      }
    ]
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

  private async waterPlants(userId: string, where: Prisma.UserPlantWhereInput) {
    const wateredAt = new Date()
    const plants = await this.prisma.userPlant.findMany({
      where: {
        ...where,
        userId
      }
    })

    if (!plants.length) return []

    return this.prisma.$transaction(async tx => {
      const updatedPlants = await Promise.all(
        plants.map(plant =>
          tx.userPlant.update({
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

      await tx.plantCareEvent.createMany({
        data: plants.map(plant => ({
          plantId: plant.id,
          type: 'WATERING',
          title: this.getCareEventTitle('WATERING'),
          eventAt: wateredAt,
          amountMl: plant.wateringAmountMl,
          description: plant.wateringNotes
        }))
      })

      return updatedPlants
    })
  }

  private getWeatherWateringAdvice({
    city,
    dueTodayCount,
    dueTomorrowCount,
    weather
  }: {
    city?: string | null
    dueTodayCount: number
    dueTomorrowCount: number
    weather: CurrentWeatherSummary | null
  }): WeatherWateringAdvice {
    const upcomingCount = dueTodayCount + dueTomorrowCount

    if (!upcomingCount) {
      return {
        tone: 'normal',
        title: 'Ближайших поливов нет',
        text: 'По расписанию на сегодня и завтра полив не требуется.',
        details: [
          'Можно ограничиться быстрой проверкой влажности верхнего слоя.'
        ]
      }
    }

    if (!city?.trim()) {
      return {
        tone: 'attention',
        title: 'Город не указан',
        text: 'Добавьте город в профиле, чтобы учитывать погоду при ближайших поливах.',
        details: [
          `${upcomingCount} ${this.formatCount(upcomingCount, [
            'растение',
            'растения',
            'растений'
          ])} в ближайшем поливе останутся в обычном расписании.`
        ]
      }
    }

    if (!weather) {
      return {
        tone: 'attention',
        title: 'Погода недоступна',
        text: 'Не удалось получить погодные данные, поэтому ориентируйтесь на расписание и влажность грунта.',
        details: [
          `${dueTodayCount} сегодня, ${dueTomorrowCount} завтра по текущему графику.`
        ]
      }
    }

    const temperature = weather.apparentTemperatureC ?? weather.temperatureC
    const humidity = weather.humidityPercent
    const precipitation =
      (weather.today.precipitationMm ?? 0) +
      (dueTomorrowCount ? (weather.tomorrow.precipitationMm ?? 0) : 0)
    const hotAndDry =
      (temperature !== null && temperature >= 27) ||
      (humidity !== null && humidity <= 35)
    const coolAndWet =
      (temperature !== null && temperature <= 16) ||
      (humidity !== null && humidity >= 75) ||
      precipitation >= 8

    if (hotAndDry) {
      return {
        tone: 'caution',
        title: 'Жарко или сухо',
        text: 'Ближайшие поливы лучше не откладывать, но перед поливом все равно проверьте грунт.',
        details: [
          `${dueTodayCount} сегодня, ${dueTomorrowCount} завтра.`,
          'Если растение стоит у окна или батареи, верхний слой может пересохнуть быстрее.'
        ]
      }
    }

    if (coolAndWet) {
      return {
        tone: 'attention',
        title: 'Прохладно или влажно',
        text: 'Есть риск перелива: поливайте только растения с подсохшим верхним слоем грунта.',
        details: [
          `${dueTodayCount} сегодня, ${dueTomorrowCount} завтра.`,
          'Для растений в прохладных местах лучше уменьшить объем воды.'
        ]
      }
    }

    return {
      tone: 'normal',
      title: 'Погода спокойная',
      text: 'Можно идти по обычному графику и точечно проверить растения из ближайшего списка.',
      details: [
        `${dueTodayCount} сегодня, ${dueTomorrowCount} завтра.`,
        'Погодных причин массово сдвигать полив нет.'
      ]
    }
  }

  private formatCount(count: number, labels: [string, string, string]) {
    const lastTwoDigits = count % 100
    const lastDigit = count % 10

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return labels[2]
    if (lastDigit === 1) return labels[0]
    if (lastDigit >= 2 && lastDigit <= 4) return labels[1]

    return labels[2]
  }

  async getAll(userId: string) {
    return this.prisma.userPlant.findMany({
      where: {
        userId
      }
    })
  }

  async getUserPhotoUsages(userId: string) {
    return this.prisma.userPlant.findMany({
      where: {
        userId,
        photoUrl: {
          not: null
        }
      },
      select: {
        id: true,
        nickname: true,
        plantName: true,
        location: true,
        photoUrl: true
      }
    })
  }

  async getUserCareEventPhotoUsages(userId: string) {
    return this.prisma.plantCareEvent.findMany({
      where: {
        photoUrl: {
          not: null
        },
        plant: {
          userId
        }
      },
      select: {
        id: true,
        type: true,
        title: true,
        eventAt: true,
        photoUrl: true,
        plant: {
          select: {
            id: true,
            nickname: true,
            plantName: true,
            location: true
          }
        }
      }
    })
  }

  async getAllPhotoUsages() {
    return this.prisma.userPlant.findMany({
      where: {
        photoUrl: {
          not: null
        }
      },
      select: {
        id: true,
        nickname: true,
        plantName: true,
        location: true,
        photoUrl: true
      }
    })
  }

  async getAllCareEventPhotoUsages() {
    return this.prisma.plantCareEvent.findMany({
      where: {
        photoUrl: {
          not: null
        }
      },
      select: {
        id: true,
        photoUrl: true
      }
    })
  }

  async getPlantPhotoTarget(plantId: string, userId: string) {
    const plant = await this.prisma.userPlant.findFirst({
      where: {
        id: plantId,
        userId
      },
      select: {
        id: true,
        nickname: true,
        plantName: true
      }
    })

    if (!plant) throw new NotFoundException('Plant not found')

    return plant
  }

  async getById(id: string, userId: string) {
    return this.prisma.userPlant.findFirst({
      where: {
        id,
        userId
      },
      include: {
        careEvents: {
          orderBy: this.getCareEventOrderBy()
        }
      }
    })
  }

  async getCareEvents(plantId: string, userId: string) {
    const plant = await this.prisma.userPlant.findFirst({
      where: {
        id: plantId,
        userId
      },
      select: {
        id: true
      }
    })

    if (!plant) throw new NotFoundException('Plant not found')

    return this.prisma.plantCareEvent.findMany({
      where: {
        plantId
      },
      orderBy: this.getCareEventOrderBy()
    })
  }

  async getAllCareEvents(userId: string, query: GetPlantCareEventsDto) {
    const where: Prisma.PlantCareEventWhereInput = {
      plant: {
        userId
      }
    }

    if (query.plantId) {
      where.plantId = query.plantId
    }

    if (query.type) {
      where.type = query.type
    }

    if (query.dateFrom || query.dateTo) {
      where.eventAt = {}

      if (query.dateFrom) {
        where.eventAt.gte = new Date(query.dateFrom)
      }

      if (query.dateTo) {
        const dateTo = new Date(query.dateTo)
        dateTo.setUTCDate(dateTo.getUTCDate() + 1)
        where.eventAt.lt = dateTo
      }
    }

    return this.prisma.plantCareEvent.findMany({
      where,
      orderBy: this.getCareEventOrderBy(),
      include: {
        plant: {
          select: {
            id: true,
            nickname: true,
            plantName: true,
            location: true,
            photoUrl: true
          }
        }
      }
    })
  }

  async createCareEvent(
    plantId: string,
    userId: string,
    dto: CreatePlantCareEventDto
  ) {
    const plant = await this.prisma.userPlant.findFirst({
      where: {
        id: plantId,
        userId
      }
    })

    if (!plant) throw new NotFoundException('Plant not found')

    const eventAt = dto.eventAt ? new Date(dto.eventAt) : new Date()
    const updateData: Prisma.UserPlantUncheckedUpdateInput = {}

    if (dto.type === 'WATERING') {
      updateData.lastWateredAt = eventAt
      updateData.nextWateringAt = this.getNextWateringDate(eventAt, plant)
    }

    if (dto.type === 'FERTILIZING') {
      updateData.lastFertilizedAt = eventAt
      updateData.nextFertilizingAt = this.getNextFertilizingDate(eventAt, plant)
    }

    if (dto.type === 'REPOTTING') {
      updateData.lastRepottedAt = eventAt
    }

    await this.prisma.$transaction(async tx => {
      if (Object.keys(updateData).length) {
        await tx.userPlant.update({
          where: {
            id: plantId
          },
          data: updateData
        })
      }

      await tx.plantCareEvent.create({
        data: {
          plantId,
          type: dto.type,
          title: dto.title?.trim() || this.getCareEventTitle(dto.type),
          description: dto.description?.trim() || null,
          eventAt,
          amountMl: dto.amountMl ?? null,
          photoUrl: dto.photoUrl?.trim() || null
        }
      })
    })

    return this.getById(plantId, userId)
  }

  async deleteCareEvent(plantId: string, eventId: string, userId: string) {
    const plant = await this.prisma.userPlant.findFirst({
      where: {
        id: plantId,
        userId
      }
    })

    if (!plant) throw new NotFoundException('Plant not found')

    const careEvent = await this.prisma.plantCareEvent.findFirst({
      where: {
        id: eventId,
        plantId
      }
    })

    if (!careEvent) throw new NotFoundException('Care event not found')

    await this.prisma.$transaction(async tx => {
      await tx.plantCareEvent.delete({
        where: {
          id: eventId
        }
      })

      if (careEvent.type === 'WATERING') {
        const latestWatering = await tx.plantCareEvent.findFirst({
          where: {
            plantId,
            type: 'WATERING'
          },
          orderBy: this.getCareEventOrderBy()
        })

        await tx.userPlant.update({
          where: {
            id: plantId
          },
          data: {
            lastWateredAt: latestWatering?.eventAt ?? null,
            nextWateringAt: latestWatering
              ? this.getNextWateringDate(latestWatering.eventAt, {
                  ...plant,
                  lastWateredAt: null,
                  nextWateringAt: null
                })
              : null
          }
        })
      }

      if (careEvent.type === 'FERTILIZING') {
        const latestFertilizing = await tx.plantCareEvent.findFirst({
          where: {
            plantId,
            type: 'FERTILIZING'
          },
          orderBy: this.getCareEventOrderBy()
        })

        await tx.userPlant.update({
          where: {
            id: plantId
          },
          data: {
            lastFertilizedAt: latestFertilizing?.eventAt ?? null,
            nextFertilizingAt: latestFertilizing
              ? this.getNextFertilizingDate(latestFertilizing.eventAt, plant)
              : null
          }
        })
      }

      if (careEvent.type === 'REPOTTING') {
        const latestRepotting = await tx.plantCareEvent.findFirst({
          where: {
            plantId,
            type: 'REPOTTING'
          },
          orderBy: this.getCareEventOrderBy()
        })

        await tx.userPlant.update({
          where: {
            id: plantId
          },
          data: {
            lastRepottedAt: latestRepotting?.eventAt ?? null
          }
        })
      }
    })

    return this.getById(plantId, userId)
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

  async getWeatherWateringOverview(userId: string) {
    const [user, wateringOverview] = await Promise.all([
      this.prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          city: true
        }
      }),
      this.getWateringOverview(userId)
    ])
    const city = user?.city?.trim() || null
    const weather = city
      ? await this.weatherService.getCurrentSummary(city).catch(() => null)
      : null
    const dueTodayCount = wateringOverview.dueToday.length
    const dueTomorrowCount = wateringOverview.dueTomorrow.length

    return {
      city,
      weather,
      dueTodayCount,
      dueTomorrowCount,
      upcomingPlantCount: dueTodayCount + dueTomorrowCount,
      advice: this.getWeatherWateringAdvice({
        city,
        dueTodayCount,
        dueTomorrowCount,
        weather
      })
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
