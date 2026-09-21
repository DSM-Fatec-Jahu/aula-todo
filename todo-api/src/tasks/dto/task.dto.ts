import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TaskStatus } from '../../generated/prisma/enums.js';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
