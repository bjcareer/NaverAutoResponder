import { IsString, IsNotEmpty } from 'class-validator';

export class QuestionSearchDto {
  @IsString()
  @IsNotEmpty()
  query!: string;
}
