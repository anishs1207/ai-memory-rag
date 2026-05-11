import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class ChatMessage {
  @IsString()
  @IsNotEmpty()
  role: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ChatMemoryDto {
  @IsArray()
  @IsOptional()
  history?: ChatMessage[];

  @IsString()
  @IsNotEmpty()
  query: string;
}
