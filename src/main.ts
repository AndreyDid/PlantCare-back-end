import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import cookieParser from 'cookie-parser'
import { ConfigService } from '@nestjs/config'

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/$/, '')

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
  const corsOrigins = frontendUrl
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)

  app.setGlobalPrefix('api')

  app.use(cookieParser())
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true)
        return
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`))
    },
    credentials: true,
    exposedHeaders: ['Set-Cookie']
  })

  const port = Number(configService.get<string>('PORT') ?? 4200)

  await app.listen(port)
}
bootstrap().catch(err => console.error('Failed to start app:', err))
