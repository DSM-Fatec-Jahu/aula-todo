import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { SharePermission } from '../../generated/prisma/enums.js';

export class CreateShareDto {
  @IsOptional()
  @IsEnum(SharePermission)
  permission?: SharePermission;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
