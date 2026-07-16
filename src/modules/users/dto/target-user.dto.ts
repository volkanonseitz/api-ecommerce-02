import { IsInt } from 'class-validator';

export class TargetUserByIdDto {
  @IsInt()
  id!: number;
}

export class TargetUserByUserIdDto {
  @IsInt()
  user_id!: number;
}
