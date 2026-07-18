import { IsInt } from 'class-validator';

/** Padanan FollowShopRequest.php. */
export class FollowShopDto {
  @IsInt()
  shop_id!: number;
}
