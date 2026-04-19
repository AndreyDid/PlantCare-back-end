import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { UserService } from 'src/user/user.service'
import { ExtractJwt, Strategy } from 'passport-jwt'

type JwtPayload = {
  id: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET')
    })
  }
  async validate(payload: JwtPayload) {
    return this.userService.getById(payload.id)
  }
}
