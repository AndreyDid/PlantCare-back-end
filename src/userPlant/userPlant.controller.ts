import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import { memoryStorage } from 'multer'
import { extname } from 'path'
import { UserPlantService } from './userPlant.service'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { CurrentUser } from 'src/auth/decorators/user.decorator'
import { UserPlantDto } from './dto/userPlant.dto'
import { UpdateUserPlantDto } from './dto/update-userPlant.dto'
import { WaterUserPlantsDto } from './dto/water-user-plants.dto'
import { CreatePlantCareEventDto } from './dto/create-plant-care-event.dto'

const imageExtensionsByMimeType: Record<string, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}
type UploadedPlantPhoto = {
  originalname: string
  mimetype: string
  buffer: Buffer
}

@Controller('user/plants')
export class UserPlantController {
  private readonly s3Client: S3Client

  constructor(
    private readonly userPlantService: UserPlantService,
    private readonly configService: ConfigService
  ) {
    this.s3Client = new S3Client({
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
      region: this.configService.get<string>('S3_REGION') ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY') ?? '',
        secretAccessKey: this.configService.get<string>('S3_SECRET_KEY') ?? ''
      }
    })
  }

  private getS3Config() {
    const endpoint = this.configService.get<string>('S3_ENDPOINT')
    const bucket = this.configService.get<string>('S3_BUCKET')
    const publicUrl = this.configService.get<string>('S3_PUBLIC_URL')
    const accessKey = this.configService.get<string>('S3_ACCESS_KEY')
    const secretKey = this.configService.get<string>('S3_SECRET_KEY')

    if (!endpoint || !bucket || !publicUrl || !accessKey || !secretKey) {
      throw new InternalServerErrorException('S3 storage is not configured')
    }

    return {
      bucket,
      publicUrl: publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`
    }
  }

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
      storage: memoryStorage(),
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

    const { bucket, publicUrl } = this.getS3Config()
    const extension =
      imageExtensionsByMimeType[file.mimetype] ||
      extname(file.originalname).toLowerCase()
    const key = `plants/${Date.now()}-${randomUUID()}${extension}`

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    )

    return {
      url: new URL(key, publicUrl).toString()
    }
  }

  @Get(':id')
  @Auth()
  async getById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.userPlantService.getById(id, userId)
  }

  @Get(':id/events')
  @Auth()
  async getCareEvents(
    @Param('id') id: string,
    @CurrentUser('id') userId: string
  ) {
    return this.userPlantService.getCareEvents(id, userId)
  }

  @UsePipes(new ValidationPipe())
  @HttpCode(200)
  @Post(':id/events')
  @Auth()
  async createCareEvent(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePlantCareEventDto
  ) {
    return this.userPlantService.createCareEvent(id, userId, dto)
  }

  @HttpCode(200)
  @Delete(':id/events/:eventId')
  @Auth()
  async deleteCareEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @CurrentUser('id') userId: string
  ) {
    return this.userPlantService.deleteCareEvent(id, eventId, userId)
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
