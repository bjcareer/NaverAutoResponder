import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ProcessQuestionDto {
  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsString()
  @IsOptional()
  promotionLink?: string;
}
