import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { Expose, Type } from "class-transformer";

export class CreateSignatureDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsString()
    content: string;

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    isDefault: boolean;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    attachmentIds?: string[];
}