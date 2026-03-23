import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  // Minimo 8 caratteri, almeno una maiuscola, una minuscola e un numero
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La password deve contenere almeno una lettera maiuscola, una minuscola e un numero',
  })
  password: string;
}
