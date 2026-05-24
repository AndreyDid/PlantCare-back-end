import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common'
import { AuthService } from './auth.service'
import { AuthDto } from './dto/auth.dto'
import { Request, Response } from 'express'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: AuthDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...response } = await this.authService.login(dto)
    this.authService.addRefreshTokenToResponse(
      res,
      refreshToken,
      Boolean(dto.rememberMe)
    )
    return response
  }

  @HttpCode(200)
  @Post('register')
  async register(
    @Body() dto: AuthDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { refreshToken, ...response } = await this.authService.register(dto)
    this.authService.addRefreshTokenToResponse(
      res,
      refreshToken,
      Boolean(dto.rememberMe)
    )
    return response
  }

  @HttpCode(200)
  @Post('login/access-token')
  async getNewTokens(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshTokenFromCookies =
      req.cookies[this.authService.REFRESH_TOKEN_NAME]

    if (!refreshTokenFromCookies) {
      this.authService.removeRefreshTokenToResponse(res)
      throw new UnauthorizedException('Refresh token not passed')
    }

    try {
      const { refreshToken, rememberMe, ...response } =
        await this.authService.getNewTokens(refreshTokenFromCookies)

      this.authService.addRefreshTokenToResponse(res, refreshToken, rememberMe)

      return response
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.authService.removeRefreshTokenToResponse(res)
      }

      throw error
    }
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(
      req.cookies[this.authService.REFRESH_TOKEN_NAME]
    )
    this.authService.removeRefreshTokenToResponse(res)

    return true
  }
}
