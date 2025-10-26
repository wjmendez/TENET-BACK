import { IsString } from 'class-validator';

export class GetCredentialDto {
  @IsString()
  id: string;
}
