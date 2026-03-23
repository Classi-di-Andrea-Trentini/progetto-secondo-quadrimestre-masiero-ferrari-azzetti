import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail()
  @MaxLength(255)
  newEmail: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;
}
