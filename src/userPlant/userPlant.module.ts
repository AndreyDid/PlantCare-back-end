import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { UserPlantService } from './userPlant.service'
import { UserPlantController } from './userPlant.controller'

@Module({
  controllers: [UserPlantController],
  providers: [UserPlantService, PrismaService],
  exports: [UserPlantService]
})
export class UserPlantModule {}
