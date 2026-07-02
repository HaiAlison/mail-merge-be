import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CampaignStatus } from 'src/entity/enums';


export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  // @IsArray()
  // @ValidateNested({ each: true })
  // recipients: Record<string, any>[]; // Array of objects with email and other keys

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  placeholders: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  placeholdersMap?: Record<string, string>;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  dataSourceId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  attachmentIds?: string[];

  @IsNotEmpty()
  @IsEnum(CampaignStatus)
  status: CampaignStatus;

}
