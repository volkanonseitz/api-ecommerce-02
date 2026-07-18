import { IsLatitude, IsLongitude } from 'class-validator';

/** Padanan NearbyShopRequest.php. */
export class NearbyShopDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}
