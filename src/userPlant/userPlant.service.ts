import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { UserPlantDto } from './dto/userPlant.dto'

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

  async getById(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id
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
        userId
      }
    })
  }

  async update(dto: Partial<UserPlantDto>, plantId: string, userId: string) {
    return this.prisma.userPlant.update({
      where: {
        userId,
        id: plantId
      },
      data: {
        plantName: dto.plantName,
        plantTypeId: dto.plantTypeId,
        nickname: dto.nickname,
        photoUrl: dto.photoUrl
      }
    })
  }

  async delete(plantId: string) {
    return this.prisma.userPlant.delete({
      where: {
        id: plantId
      }
    })
  }
}
