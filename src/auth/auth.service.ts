import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { hash, verify } from 'argon2'
import { type CookieOptions, Response } from 'express'
import { UserService } from 'src/user/user.service'
import { AuthDto } from './dto/auth.dto'

type RefreshTokenPayload = {
  id: string
  rememberMe?: boolean
  type?: 'refresh'
}

@Injectable()
export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRES_IN = '15m'
  private readonly SESSION_REFRESH_TOKEN_EXPIRES_IN = '1d'
  private readonly REMEMBER_REFRESH_TOKEN_EXPIRES_IN = '30d'
  private readonly REMEMBER_REFRESH_TOKEN_EXPIRE_DAYS = 30
  REFRESH_TOKEN_NAME = 'refreshToken'

  constructor(
    private jwt: JwtService,
    private userService: UserService,
    private configService: ConfigService
  ) {}
  async login(dto: AuthDto) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshTokenHash, ...user } = await this.validateUser(dto)
    const tokens = this.issueTokens(user.id, Boolean(dto.rememberMe))
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken)

    return { user, ...tokens }
  }

  async register(dto: AuthDto) {
    const oldUser = await this.userService.getByEmail(dto.email)

    if (oldUser) {
      throw new BadRequestException('Unable to register with provided data')
    }

    const { password, refreshTokenHash, ...user } =
      await this.userService.create(dto)

    const tokens = this.issueTokens(user.id, Boolean(dto.rememberMe))
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken)

    return { user, ...tokens }
  }

  async getNewTokens(refreshToken: string) {
    let result: RefreshTokenPayload

    try {
      result = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken)
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    if (!result || result.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const currentUser = await this.userService.getByIdWithRefreshToken(
      result.id
    )
    if (!currentUser) throw new UnauthorizedException('Invalid refresh token')
    await this.validateRefreshTokenHash(
      currentUser.refreshTokenHash,
      refreshToken
    )

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { refreshTokenHash, ...user } = currentUser

    const rememberMe = Boolean(result.rememberMe)
    const tokens = this.issueTokens(user.id, rememberMe)
    await this.saveRefreshTokenHash(user.id, tokens.refreshToken)

    return { user, ...tokens, rememberMe }
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return

    try {
      const result = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshToken
      )

      if (result?.id && result.type === 'refresh') {
        await this.userService.updateRefreshTokenHash(result.id, null)
      }
    } catch {
      return
    }
  }

  private issueTokens(userId: string, rememberMe: boolean) {
    const accessTokenData = { id: userId, type: 'access' }
    const refreshTokenData = { id: userId, rememberMe, type: 'refresh' }

    const accessToken = this.jwt.sign(accessTokenData, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN
    })

    const refreshToken = this.jwt.sign(refreshTokenData, {
      expiresIn: rememberMe
        ? this.REMEMBER_REFRESH_TOKEN_EXPIRES_IN
        : this.SESSION_REFRESH_TOKEN_EXPIRES_IN
    })

    return { accessToken, refreshToken }
  }

  private async validateUser(dto: AuthDto) {
    const user = await this.userService.getByEmail(dto.email)

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const isValid = await verify(user.password, dto.password)
    if (!isValid) throw new UnauthorizedException('Invalid email or password')

    return user
  }

  private async saveRefreshTokenHash(userId: string, refreshToken: string) {
    await this.userService.updateRefreshTokenHash(
      userId,
      await hash(refreshToken)
    )
  }

  private async validateRefreshTokenHash(
    refreshTokenHash: string | null,
    refreshToken: string
  ) {
    if (!refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const isValid = await verify(refreshTokenHash, refreshToken)

    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  addRefreshTokenToResponse(
    res: Response,
    refreshToken: string,
    rememberMe: boolean
  ) {
    const expiresIn = rememberMe ? new Date() : undefined

    if (expiresIn) {
      expiresIn.setDate(
        expiresIn.getDate() + this.REMEMBER_REFRESH_TOKEN_EXPIRE_DAYS
      )
    }

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

  private getRefreshTokenCookieOptions(expires?: Date): CookieOptions {
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN')
    const secure = this.shouldUseSecureCookies()

    return {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      ...(expires ? { expires } : {}),
      ...(cookieDomain ? { domain: cookieDomain } : {})
    }
  }

  private shouldUseSecureCookies() {
    const cookieSecure = this.configService.get<string>('COOKIE_SECURE')

    if (cookieSecure) return cookieSecure === 'true'

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'

    const frontendUrls = frontendUrl
      .split(',')
      .map(url => url.trim())
      .filter(Boolean)

    if (!frontendUrls.length) return false

    return frontendUrls.every(url => {
      try {
        return new URL(url).protocol === 'https:'
      } catch {
        return false
      }
    })
  }
}
