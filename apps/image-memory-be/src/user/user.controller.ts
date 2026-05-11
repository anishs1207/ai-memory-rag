import {
  Body,
  Controller,
  Get,
  Req,
  Post,
  HttpCode,
  Res,
} from '@nestjs/common';
import { UserService } from './user.service';
import { Request, Response } from 'express';
import { RegisterUserDto, LoginUserDto } from './dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @HttpCode(201)
  registerUser(
    @Body() registerUserDto: RegisterUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // use of passthrough: not to take over the entire response handling, so you can still return a value normally.
    return this.userService.registerUser(registerUserDto, res);
  }

  @Post('login')
  loginUser(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.userService.loginUser(loginUserDto, res);
  }

  @Get('user-session')
  getUserSession(@Req() req: Request) {
    return this.userService.getUserSession(req);
  }

  @Post('logout')
  logoutUser(@Req() req: Request) {
    return this.userService.logoutUser(req);
  }

  @Get('me')
  getMe() {
    return this.userService.getHelloWorld();
  }
}
