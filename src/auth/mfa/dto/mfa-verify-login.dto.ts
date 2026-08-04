import { IsString, Length } from 'class-validator';

export class MfaVerifyLoginDto {
  @IsString()
  mfa_token: string;

  @IsString()
  @Length(6, 6)
  token: string;
}
