import { Injectable, NotFoundException } from '@nestjs/common'
import { hash } from 'argon2'
import { AuthDto } from 'src/auth/dto/auth.dto'
import { PrismaService } from 'src/prisma.service'
import { UserDto } from './dto/user.dto'

const windowDirectionLabels: Record<string, string> = {
  north: 'Север',
  east: 'Восток',
  south: 'Юг',
  west: 'Запад'
}

function nullableString(value?: string | null) {
  if (value === undefined) return undefined

  const normalizedValue = value?.trim()

  return normalizedValue ? normalizedValue : null
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getById(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id
      }
      // include: {
      //   plants: true
      // }
    })
  }

  async getByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email
      }
    })
  }

  async getProfile(id: string) {
    const profile = await this.prisma.user.findUnique({
      where: {
        id
      },
      include: {
        _count: {
          select: {
            plants: true
          }
        }
      }
    })

    if (!profile) throw new NotFoundException('User not found')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, _count, ...user } = profile
    const windowDirections = user.windowDirections
      .map(direction => windowDirectionLabels[direction])
      .filter(Boolean)

    return {
      user,
      statistics: [
        {
          label: 'Растений',
          value: String(_count.plants)
        },
        {
          label: 'Город',
          value: user.city || 'Не указан'
        },
        {
          label: 'Окна',
          value: windowDirections.length ? windowDirections.join(', ') : 'Не указано'
        }
      ]
    }
  }

  async create(dto: AuthDto) {
    const user = {
      email: dto.email,
      name: '',
      password: await hash(dto.password)
    }

    return this.prisma.user.create({
      data: user
    })
  }

  async update(id: string, dto: UserDto) {
    const data: {
      email?: string
      name?: string | null
      city?: string | null
      windowDirections?: string[]
      password?: string
    } = {}

    if (dto.email !== undefined) data.email = dto.email.trim()
    if (dto.name !== undefined) data.name = nullableString(dto.name)
    if (dto.city !== undefined) data.city = nullableString(dto.city)
    if (dto.windowDirections !== undefined) {
      data.windowDirections = dto.windowDirections
    }

    if (dto.password?.trim()) {
      data.password = await hash(dto.password.trim())
    }

    await this.prisma.user.update({
      where: {
        id
      },
      data
    })

    return this.getProfile(id)
  }
}
