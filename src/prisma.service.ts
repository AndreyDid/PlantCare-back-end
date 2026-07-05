import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaClient } from 'src/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL')
    const databaseSsl = configService.get<string>('DATABASE_SSL') === 'true'
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseSsl ? { rejectUnauthorized: false } : undefined
    })
    const adapter = new PrismaPg(pool)
    super({ adapter })
  }

  async onModuleInit() {
    await this.$connect()
  }
}
