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

const windowDirectionValues = Object.keys(windowDirectionLabels)
const windowPlacementSeparator = '|'

function parseWindowPlacementEntry(value: string) {
  const [direction, ...labelParts] = value.split(windowPlacementSeparator)

  if (!windowDirectionValues.includes(direction)) return null

  const label = labelParts
    .join(windowPlacementSeparator)
    .replace(/\s+/g, ' ')
    .trim()

  return {
    direction,
    label
  }
}

function encodeWindowPlacementEntry(placement: {
  direction: string
  label: string
}) {
  return placement.label
    ? `${placement.direction}${windowPlacementSeparator}${placement.label}`
    : placement.direction
}

function normalizeWindowPlacementEntries(values?: string[]) {
  const seen = new Set<string>()

  return (values ?? []).reduce<string[]>((entries, value) => {
    const placement = parseWindowPlacementEntry(value)

    if (!placement) return entries

    const entry = encodeWindowPlacementEntry(placement)

    if (seen.has(entry)) return entries

    seen.add(entry)
    entries.push(entry)

    return entries
  }, [])
}

function formatWindowPlacementEntry(value: string) {
  const placement = parseWindowPlacementEntry(value)

  if (!placement) return null

  const directionLabel = windowDirectionLabels[placement.direction]

  return placement.label
    ? `${placement.label} (${directionLabel})`
    : directionLabel
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
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        email: true,
        name: true,
        city: true,
        windowDirections: true
      }
    })
  }

  async getByIdWithRefreshToken(id: string) {
    return this.prisma.user.findUnique({
      where: {
        id
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        email: true,
        name: true,
        city: true,
        windowDirections: true,
        refreshTokenHash: true
      }
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
    const { password, refreshTokenHash, _count, ...user } = profile
    const windowDirections = user.windowDirections
      .map(formatWindowPlacementEntry)
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
      data.windowDirections = normalizeWindowPlacementEntries(dto.windowDirections)
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

  async updateRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: {
        id
      },
      data: {
        refreshTokenHash
      }
    })
  }
}
