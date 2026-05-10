import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UsePipes,
  ValidationPipe
} from '@nestjs/common'
import { UserPlantService } from './userPlant.service'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { CurrentUser } from 'src/auth/decorators/user.decorator'
import { UserPlantDto } from './dto/userPlant.dto'
import { UpdateUserPlantDto } from './dto/update-userPlant.dto'
import { WaterUserPlantsDto } from './dto/water-user-plants.dto'

@Controller('user/plants')
export class UserPlantController {
  constructor(private readonly userPlantService: UserPlantService) {}

  @Get()
  @Auth()
  async getAll(@CurrentUser('id') userId: string) {
    return this.userPlantService.getAll(userId)
  }

  @Get('watering-overview')
  @Auth()
  async getWateringOverview(@CurrentUser('id') userId: string) {
    return this.userPlantService.getWateringOverview(userId)
  }

  @HttpCode(200)
  @Post('water-all')
  @Auth()
  async waterAll(@CurrentUser('id') userId: string) {
    return this.userPlantService.waterAll(userId)
  }

  @HttpCode(200)
  @Post('water-due-today')
  @Auth()
  async waterDueToday(@CurrentUser('id') userId: string) {
    return this.userPlantService.waterDueToday(userId)
  }

  @UsePipes(new ValidationPipe())
  @HttpCode(200)
  @Post('water-selected')
  @Auth()
  async waterSelected(
    @Body() dto: WaterUserPlantsDto,
    @CurrentUser('id') userId: string
  ) {
    return this.userPlantService.waterSelected(userId, dto.plantIds)
  }

  @Get(':id')
  @Auth()
  async getById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.userPlantService.getById(id, userId)
  }

  @UsePipes(new ValidationPipe())
  @HttpCode(200)
  @Post()
  @Auth()
  async create(@Body() dto: UserPlantDto, @CurrentUser('id') userId: string) {
    return this.userPlantService.create(dto, userId)
  }

  @UsePipes(new ValidationPipe())
  @HttpCode(200)
  @Put(':id')
  @Auth()
  async update(
    @Body() dto: UpdateUserPlantDto,
    @CurrentUser('id') userId: string,
    @Param('id') id: string
  ) {
    return this.userPlantService.update(dto, id, userId)
  }

  @HttpCode(200)
  @Delete(':id')
  @Auth()
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.userPlantService.delete(id, userId)
  }
}
