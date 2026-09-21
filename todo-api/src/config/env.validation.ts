import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  DB_POOL_MAX: number = 5;

  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  @IsString()
  @IsNotEmpty()
  MONGODB_DB: string = 'todo';

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '1d';

  @IsString()
  CORS_ORIGINS: string = 'http://localhost:5173';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS: number = 1;

  @IsIn(['gcs', 'local'])
  STORAGE_DRIVER: 'gcs' | 'local' = 'local';

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_DRIVER === 'gcs')
  @IsString()
  @IsNotEmpty()
  GCS_BUCKET?: string;

  @IsString()
  LOCAL_STORAGE_DIR: string = './.storage';

  @IsOptional()
  @IsString()
  PUBLIC_API_URL?: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  SIGNED_URL_TTL_SECONDS: number = 600;

  @Type(() => Number)
  @IsInt()
  @Min(1024)
  MAX_UPLOAD_BYTES: number = 10 * 1024 * 1024;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Variaveis de ambiente invalidas:\n${detail}`);
  }
  return validated;
}
