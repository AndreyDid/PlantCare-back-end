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
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
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
import { GetPlantCareEventsDto } from './dto/get-plant-care-events.dto'
import { ExistingPlantAiDto, SuggestPlantCareDto } from './dto/plant-ai.dto'
import { PlantAiService } from './plant-ai.service'

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

type PlantPhotoUsage = {
  id: string
  nickname: string | null
  plantName: string | null
  location: string | null
  photoUrl: string | null
}

type CareEventPhotoUsage = {
  id: string
  type: string
  title: string | null
  eventAt: Date
  photoUrl: string | null
  plant: {
    id: string
    nickname: string | null
    plantName: string | null
    location: string | null
  }
}

type PhotoUsageWithUrl = PlantPhotoUsage | CareEventPhotoUsage

type StoredPhotoObject = {
  key: string
  size: number | null
  uploadedAt: Date | null
}

@Controller('user/plants')
export class UserPlantController {
  private readonly s3Client: S3Client

  constructor(
    private readonly userPlantService: UserPlantService,
    private readonly plantAiService: PlantAiService,
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

  private getPhotoUrl(key: string, publicUrl: string) {
    return new URL(key, publicUrl).toString()
  }

  private getPhotoExtension(file: UploadedPlantPhoto) {
    return (
      imageExtensionsByMimeType[file.mimetype] ||
      extname(file.originalname).toLowerCase()
    )
  }

  private getSafeS3PathSegment(value?: string | null) {
    const slug = value
      ?.trim()
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')

    return slug || 'plant'
  }

  private getCareEventPhotoKey({
    extension,
    plant,
    userId
  }: {
    extension: string
    plant: {
      id: string
      nickname: string | null
      plantName: string | null
    }
    userId: string
  }) {
    const plantSlug = this.getSafeS3PathSegment(
      plant.nickname || plant.plantName
    )

    return `plants/${userId}/${plantSlug}-${plant.id}/notes/${Date.now()}-${randomUUID()}${extension}`
  }

  private getPhotoKeyFromUrl(photoUrl: string, publicUrl: string) {
    try {
      const photoUrlObject = new URL(photoUrl)
      const publicUrlObject = new URL(publicUrl)
      const publicPath = publicUrlObject.pathname.endsWith('/')
        ? publicUrlObject.pathname
        : `${publicUrlObject.pathname}/`

      if (photoUrlObject.origin !== publicUrlObject.origin) return null
      if (!photoUrlObject.pathname.startsWith(publicPath)) return null

      const key = decodeURIComponent(
        photoUrlObject.pathname.slice(publicPath.length)
      )

      return key || null
    } catch {
      return null
    }
  }

  private getUsageByPhotoKey<T extends PhotoUsageWithUrl>(
    photoUsages: T[],
    publicUrl: string
  ) {
    const usageByKey = new Map<string, T>()

    photoUsages.forEach(usage => {
      if (!usage.photoUrl) return

      const key = this.getPhotoKeyFromUrl(usage.photoUrl, publicUrl)

      if (key && !usageByKey.has(key)) usageByKey.set(key, usage)
    })

    return usageByKey
  }

  private isLegacyPlantPhotoKey(key: string) {
    const legacyPrefix = 'plants/'

    if (!key.startsWith(legacyPrefix)) return false

    return !key.slice(legacyPrefix.length).includes('/')
  }

  private async listStoredPhotos(bucket: string, prefix: string) {
    const photos: StoredPhotoObject[] = []
    let continuationToken: string | undefined

    do {
      const response = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })
      )

      response.Contents?.forEach(item => {
        if (!item.Key || item.Key.endsWith('/')) return

        photos.push({
          key: item.Key,
          size: item.Size ?? null,
          uploadedAt: item.LastModified ?? null
        })
      })

      continuationToken = response.NextContinuationToken
    } while (continuationToken)

    return photos
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

  @Get('weather-watering-overview')
  @Auth()
  async getWeatherWateringOverview(@CurrentUser('id') userId: string) {
    return this.userPlantService.getWeatherWateringOverview(userId)
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
  @UsePipes(new ValidationPipe())
  @Post('ai/suggest')
  @Auth()
  async suggestCare(@Body() dto: SuggestPlantCareDto) {
    return this.plantAiService.suggestCare(dto)
  }

  @HttpCode(200)
  @UsePipes(new ValidationPipe())
  @Post(':id/ai/suggest')
  @Auth()
  async suggestExistingCare(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ExistingPlantAiDto
  ) {
    return this.plantAiService.suggestExistingCare(id, userId, dto)
  }

  @HttpCode(200)
  @UsePipes(new ValidationPipe())
  @Post(':id/ai/analyze-care')
  @Auth()
  async analyzeCare(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ExistingPlantAiDto
  ) {
    return this.plantAiService.analyzeCare(id, userId, dto)
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
  async uploadPhoto(
    @CurrentUser('id') userId: string,
    @UploadedFile() file?: UploadedPlantPhoto
  ) {
    if (!file) throw new BadRequestException('Photo file is required')

    const { bucket, publicUrl } = this.getS3Config()
    const extension = this.getPhotoExtension(file)
    const key = `plants/${userId}/${Date.now()}-${randomUUID()}${extension}`

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    )

    return {
      url: this.getPhotoUrl(key, publicUrl)
    }
  }

  @HttpCode(200)
  @Post(':id/events/upload-photo')
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
  async uploadCareEventPhoto(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file?: UploadedPlantPhoto
  ) {
    if (!file) throw new BadRequestException('Photo file is required')

    const plant = await this.userPlantService.getPlantPhotoTarget(id, userId)
    const { bucket, publicUrl } = this.getS3Config()
    const key = this.getCareEventPhotoKey({
      extension: this.getPhotoExtension(file),
      plant,
      userId
    })

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    )

    return {
      url: this.getPhotoUrl(key, publicUrl)
    }
  }

  @Get('photos')
  @Auth()
  async getPhotoGallery(@CurrentUser('id') userId: string) {
    const { bucket, publicUrl } = this.getS3Config()
    const userPrefix = `plants/${userId}/`
    const [storedPhotos, userPhotoUsages, userCareEventPhotoUsages] =
      await Promise.all([
        this.listStoredPhotos(bucket, 'plants/'),
        this.userPlantService.getUserPhotoUsages(userId),
        this.userPlantService.getUserCareEventPhotoUsages(userId)
      ])
    const photosByKey = new Map<string, StoredPhotoObject>()
    const plantUsageByKey = this.getUsageByPhotoKey(userPhotoUsages, publicUrl)
    const careEventUsageByKey = this.getUsageByPhotoKey(
      userCareEventPhotoUsages,
      publicUrl
    )

    storedPhotos
      .filter(
        photo =>
          photo.key.startsWith(userPrefix) || this.isLegacyPlantPhotoKey(photo.key)
      )
      .forEach(photo => {
        photosByKey.set(photo.key, photo)
      })

    ;[...userPhotoUsages, ...userCareEventPhotoUsages].forEach(usage => {
      if (!usage.photoUrl) return

      const key = this.getPhotoKeyFromUrl(usage.photoUrl, publicUrl)

      if (!key || photosByKey.has(key)) return

      photosByKey.set(key, {
        key,
        size: null,
        uploadedAt: null
      })
    })

    return Array.from(photosByKey.values())
      .map(photo => {
        const plantUsage = plantUsageByKey.get(photo.key)
        const careEventUsage = careEventUsageByKey.get(photo.key)
        const usedByPlant = careEventUsage?.plant ?? plantUsage ?? null

        return {
          key: photo.key,
          url: this.getPhotoUrl(photo.key, publicUrl),
          size: photo.size,
          uploadedAt: photo.uploadedAt?.toISOString() ?? null,
          source: careEventUsage
            ? 'careEvent'
            : plantUsage
              ? 'plantProfile'
              : 'uploaded',
          isUsed: Boolean(plantUsage || careEventUsage),
          usedByPlant: usedByPlant
            ? {
                id: usedByPlant.id,
                nickname: usedByPlant.nickname,
                plantName: usedByPlant.plantName,
                location: usedByPlant.location
              }
            : null,
          usedByCareEvent: careEventUsage
            ? {
                id: careEventUsage.id,
                type: careEventUsage.type,
                title: careEventUsage.title,
                eventAt: careEventUsage.eventAt.toISOString()
              }
            : null
        }
      })
      .sort((left, right) => {
        const leftTime = left.uploadedAt ? new Date(left.uploadedAt).getTime() : 0
        const rightTime = right.uploadedAt
          ? new Date(right.uploadedAt).getTime()
          : 0

        return rightTime - leftTime
      })
  }

  @HttpCode(200)
  @Delete('photos')
  @Auth()
  async deletePhoto(
    @CurrentUser('id') userId: string,
    @Body('url') photoUrl?: string
  ) {
    if (!photoUrl) throw new BadRequestException('Photo url is required')

    const { bucket, publicUrl } = this.getS3Config()
    const key = this.getPhotoKeyFromUrl(photoUrl, publicUrl)

    if (
      !key ||
      (!key.startsWith(`plants/${userId}/`) && !this.isLegacyPlantPhotoKey(key))
    ) {
      throw new BadRequestException('Photo is not available for deletion')
    }

    const [allPhotoUsages, allCareEventPhotoUsages] = await Promise.all([
      this.userPlantService.getAllPhotoUsages(),
      this.userPlantService.getAllCareEventPhotoUsages()
    ])
    const isUsed = [...allPhotoUsages, ...allCareEventPhotoUsages].some(usage => {
      if (!usage.photoUrl) return false

      return this.getPhotoKeyFromUrl(usage.photoUrl, publicUrl) === key
    })

    if (isUsed) {
      throw new BadRequestException('Photo is used by a plant or care event')
    }

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      })
    )

    return {
      deleted: true,
      url: photoUrl
    }
  }

  @Get('events')
  @Auth()
  @UsePipes(new ValidationPipe())
  async getAllCareEvents(
    @CurrentUser('id') userId: string,
    @Query() query: GetPlantCareEventsDto
  ) {
    return this.userPlantService.getAllCareEvents(userId, query)
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
