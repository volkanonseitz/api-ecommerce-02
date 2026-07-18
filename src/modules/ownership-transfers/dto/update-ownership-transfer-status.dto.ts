import { IsIn } from 'class-validator';

export class UpdateOwnershipTransferStatusDto {
  @IsIn(['pending', 'approved', 'rejected'])
  status!: 'pending' | 'approved' | 'rejected';
}
