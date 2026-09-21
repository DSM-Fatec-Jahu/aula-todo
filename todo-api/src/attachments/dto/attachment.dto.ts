import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ALLOWED_CONTENT_TYPES } from '../../common/attachments.js';

export class RequestUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsIn([...ALLOWED_CONTENT_TYPES])
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
