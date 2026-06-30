import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsObject,
} from 'class-validator';

export class CreateRecipientDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
