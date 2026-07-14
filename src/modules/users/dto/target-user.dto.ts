import { IsInt } from 'class-validator';

/** Padanan Request::integer('id') pada UserManagementController::ban/activate. */
export class TargetUserByIdDto {
  @IsInt()
  id!: number;
}

/** Padanan Request::integer('user_id') pada UserManagementController::toggleAdmin. */
export class TargetUserByUserIdDto {
  @IsInt()
  user_id!: number;
}
