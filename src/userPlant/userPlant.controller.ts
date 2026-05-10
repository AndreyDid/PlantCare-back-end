import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { UserPlantService } from './userPlant.service'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { CurrentUser } from 'src/auth/decorators/user.decorator'
import { UserPlantDto } from './dto/userPlant.dto'
import { UpdateUserPlantDto } from './dto/update-userPlant.dto'
import { WaterUserPlantsDto } from './dto/water-user-plants.dto'

const uploadDirectory = join(process.cwd(), 'uploads', 'plants')
const imageExtensionsByMimeType: Record<string, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}
type UploadedPlantPhoto = {
  filename: string
}

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

  @HttpCode(200)
  @Post('upload-photo')
  @Auth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          mkdirSync(uploadDirectory, { recursive: true })
          callback(null, uploadDirectory)
        },
        filename: (_request, file, callback) => {
          const extension =
            imageExtensionsByMimeType[file.mimetype] ||
            extname(file.originalname).toLowerCase()

          callback(null, `${Date.now()}-${randomUUID()}${extension}`)
        }
      }),
      fileFilter: (_request, file, callback) => {
        if (!imageExtensionsByMimeType[file.mimetype]) {
          callback(
            new BadRequestException('Only image files can be uploaded'),
            false
          )
          return
        }

        callback(null, true)
      },
      limits: {
        fileSize: 5 * 1024 * 1024
      }
    })
  )
  async uploadPhoto(@UploadedFile() file?: UploadedPlantPhoto) {
    if (!file) throw new BadRequestException('Photo file is required')

    return {
      url: `/uploads/plants/${file.filename}`
    }
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
