/**
 * Bentuk response ini WAJIB dipertahankan sama persis dengan BaseController
 * Laravel yang lama:
 *   sendSuccess -> { success: true,  code, message, data }
 *   sendError   -> { success: false, code, message, errors }
 *   sendPaginated -> { success: true, code, message, data, meta }
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  code: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  code: number;
  message: string;
  errors: unknown;
}
