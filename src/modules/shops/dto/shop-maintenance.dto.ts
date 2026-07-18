import { IsBoolean } from 'class-validator';

/** Padanan ShopMaintenanceRequest.php. */
export class ShopMaintenanceDto {
  @IsBoolean()
  enable!: boolean;
}
