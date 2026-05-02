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

@Controller('user/plants')
export class UserPlantController {
  constructor(private readonly userPlantService: UserPlantService) {}

  @Get()
  @Auth()
  async getAll(@CurrentUser('id') userId: string) {
    return this.userPlantService.getAll(userId)
  }

  @HttpCode(200)
  @Post('water-all')
  @Auth()
  async waterAll(@CurrentUser('id') userId: string) {
    return this.userPlantService.waterAll(userId)
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
