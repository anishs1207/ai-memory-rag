import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class QueryMemoryDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsString()
  @IsOptional()
  context?: string;
}
