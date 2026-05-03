import { Controller, Patch, Post, Get, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('me/change-email')
  requestEmailChange(@Req() req: any, @Body() dto: ChangeEmailDto) {
    return this.usersService.requestEmailChange(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('me/send-verification')
  sendVerificationEmail(@Req() req: any) {
    return this.usersService.sendVerificationEmail(req.user.id);
  }

  @Get('verify-email/:token')
  confirmVerification(@Param('token') token: string) {
    return this.usersService.confirmVerification(token);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('me/change-password')
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.id, req.user.sessionId, dto);
  }

  // Endpoint pubblico: viene raggiunto cliccando il link nella email di conferma
  @Get('confirm-email/:token')
  confirmEmailChange(@Param('token') token: string) {
    return this.usersService.confirmEmailChange(token);
  }
}
