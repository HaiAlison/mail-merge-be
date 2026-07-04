import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AsIntDefaultValue } from './common.decorator';
import { DEFAULT_LIMIT_NUMBER, DEFAULT_PAGE_NUMBER } from './constant';
import { Expose, Transform, Type } from 'class-transformer';
import { removeUnicode } from './handle';

export class CommonDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE_NUMBER })
  @AsIntDefaultValue(DEFAULT_PAGE_NUMBER)
  @Expose()
  readonly offset?: number;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT_NUMBER })
  @AsIntDefaultValue(DEFAULT_LIMIT_NUMBER)
  @Expose()
  readonly limit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Expose()
  @Transform(({ value }) => value && '%' + removeUnicode(value).trim() + '%')
  search_string?: string;
}

export class FromToCommonDto {
  @ApiPropertyOptional({
    type: Date,
    format: 'ISOString',
    example: new Date().toISOString(),
  })
  @IsDateString()
  @IsOptional()
  @Expose()
  // @Transform(({ obj }) => {
  //   return new Date(new Date(obj.from).toUTCString()).toISOString();
  // })
  from?: Date;

  @ApiPropertyOptional({
    type: Date,
    format: 'ISOString',
    example: new Date().toISOString(),
  })
  @IsDateString()
  @IsOptional()
  @Expose()
  // @Transform(({ obj }) => {
  //   return new Date(new Date(obj.to).toUTCString()).toISOString();
  // })
  to?: Date;
}

export class CursorPaginationDto {
  @Expose()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: DEFAULT_LIMIT_NUMBER,
  })
  limit = DEFAULT_LIMIT_NUMBER;

  @Expose()
  @Type(() => String)
  @IsOptional()
  @ApiPropertyOptional({
    description: 'Cursor for pagination',
    example: 'eyJwYWdlIjoxLCJ0aW1lIjoxNjQyMzQ1NjAwMDAwfQ==',
    required: false,
  })
  cursor?: string;
}