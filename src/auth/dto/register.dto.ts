import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTO d'inscription CODENLIGNE — CDC §3
 * Champs : nom, prénom, username unique, téléphone, mot de passe, email facultatif, acceptation CGU.
 */
export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, points, tirets et underscores",
  })
  username!: string;

  // Numéro ivoirien normalisé côté serveur (E.164)
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, {
    message: 'Numéro de téléphone invalide',
  })
  phone!: string;

  // Email facultatif (CDC §3)
  @IsOptional()
  @IsEmail({}, { message: 'Adresse électronique invalide' })
  @MaxLength(255)
  email?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  // Acceptation des CGU (CDC §3)
  @IsBoolean()
  acceptedTerms!: boolean;
}