import { IsArray, IsOptional, IsString } from 'class-validator';

export class UploadImageDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];
}
