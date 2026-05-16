import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { verify } from 'argon2'
import { type CookieOptions, Response } from 'express'
import { UserService } from 'src/user/user.service'
import { AuthDto } from './dto/auth.dto'

@Injectable()
export class AuthService {
  EXPIRE_DAY_REFRESH_TOKEN = 1
  REFRESH_TOKEN_NAME = 'refreshToken'

  constructor(
    private jwt: JwtService,
    private userService: UserService,
    private configService: ConfigService
  ) {}
  async login(dto: AuthDto) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...user } = await this.validateUser(dto)
    const tokens = this.issueTokens(user.id)

    return { user, ...tokens }
  }

  async register(dto: AuthDto) {
    const oldUser = await this.userService.getByEmail(dto.email)

    if (oldUser) throw new BadRequestException('User already exists')

    const { password, ...user } = await this.userService.create(dto)

    const tokens = this.issueTokens(user.id)

    return { user, ...tokens }
  }

  async getNewTokens(refreshToken: string) {
    const result = await this.jwt.verifyAsync(refreshToken)
    if (!result) throw new UnauthorizedException('Invalid refresh token')

    const currentUser = await this.userService.getById(result.id)
    if (!currentUser) throw new UnauthorizedException('Invalid refresh token')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...user } = currentUser

    const tokens = this.issueTokens(user.id)
    return { user, ...tokens }
  }

  private issueTokens(userId: string) {
    const data = { id: userId }

    const accessToken = this.jwt.sign(data, {
      expiresIn: '1h'
    })

    const refreshToken = this.jwt.sign(data, {
      expiresIn: '7d'
    })

    return { accessToken, refreshToken }
  }

  private async validateUser(dto: AuthDto) {
    const user = await this.userService.getByEmail(dto.email)

    if (!user || !user.password) throw new NotFoundException('User not found')

    const isValid = await verify(user.password, dto.password)
    if (!isValid) throw new UnauthorizedException('Invalid password')

    return user
  }

  addRefreshTokenToResponse(res: Response, refreshToken: string) {
    const expiresIn = new Date()
    expiresIn.setDate(expiresIn.getDate() + this.EXPIRE_DAY_REFRESH_TOKEN)
    res.cookie(
      this.REFRESH_TOKEN_NAME,
      refreshToken,
      this.getRefreshTokenCookieOptions(expiresIn)
    )
  }

  removeRefreshTokenToResponse(res: Response) {
    res.cookie(
      this.REFRESH_TOKEN_NAME,
      '',
      this.getRefreshTokenCookieOptions(new Date(0))
    )
  }

  private getRefreshTokenCookieOptions(expires: Date): CookieOptions {
    const isProduction = this.configService.get('NODE_ENV') === 'production'
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN')

    return {
      httpOnly: true,
      expires,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      ...(cookieDomain ? { domain: cookieDomain } : {})
    }
  }
}
