import {
  Body,
  Controller,
  Get,
  HttpCode,
  Put
} from '@nestjs/common'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { CurrentUser } from 'src/auth/decorators/user.decorator'
import { UserService } from './user.service'
import { UserDto } from './dto/user.dto'

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @Auth()
  async getProfile(@CurrentUser('id') userId: string) {
    return this.userService.getProfile(userId)
  }

  @HttpCode(200)
  @Put('profile')
  @Auth()
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UserDto
  ) {
    return this.userService.update(userId, dto)
  }
}
