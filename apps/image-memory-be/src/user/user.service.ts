import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterUserDto, LoginUserDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async registerUser(registerUserDto: RegisterUserDto, res: Response) {
    // no need for validation since it is already done
    // instead of this zod validation can be used
    const { email, password, name } = registerUserDto;

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      throw new ConflictException({
        success: false,
        message: 'User already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    res.cookie('access_token', process.env.ACCESS_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24,
    });

    return {
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async loginUser(loginUserDto: LoginUserDto, res: Response) {
    const { email, password } = loginUserDto;

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // check is user's password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid Password');
    }

    res.cookie('access_token', process.env.ACCESS_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24,
    });

    return {
      sucess: true,
      message: 'User logged in Successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async getUserSession(req: any) {
    return {
      success: true,
      message: 'User session retrieved successfully',
      data: req.user,
    };
  }

  async logoutUser(req: any) {
    return {
      success: true,
      message: 'User logged out successfully',
    };
  }

  async getHelloWorld() {
    return 'Hello World!';
  }
}
