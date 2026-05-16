import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { DeepSeekService } from './deepseek.service'
import { PlantAiService } from './plant-ai.service'
import { UserPlantService } from './userPlant.service'
import { UserPlantController } from './userPlant.controller'
import { WeatherService } from './weather.service'

@Module({
  controllers: [UserPlantController],
  providers: [
    UserPlantService,
    PrismaService,
    DeepSeekService,
    WeatherService,
    PlantAiService
  ],
  exports: [UserPlantService]
})
export class UserPlantModule {}
