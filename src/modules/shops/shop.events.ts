export const SHOP_MAINTENANCE_EVENT = 'shop.maintenance';

export interface ShopMaintenanceEventPayload {
  shopId: number;
  action: 'enable' | 'disable' | 'start';
}
