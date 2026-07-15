import type { Response } from 'express';
import { PaginationMeta } from '../dto/api-response.dto';

/**
 * Padanan langsung dari App\Http\Controllers\BaseController (Laravel).
 * Dipakai eksplisit di controller (bukan lewat interceptor otomatis) supaya
 * kode NestJS tetap 1:1 gampang dibandingkan dengan controller lama:
 *   sendSuccess()   -> ApiResponse.success()
 *   sendError()     -> ApiResponse.error()
 *   sendPaginated() -> ApiResponse.paginated()
 */
export class ApiResponse {
  static success<T>(res: Response, data: T, message = 'Success', code = 200): Response {
    return res.status(code).json({ success: true, code, message, data });
  }

  static error(res: Response, message: string, code = 400, errors: unknown = null): Response {
    return res.status(code).json({ success: false, code, message, errors });
  }

  static paginated<T>(
    res: Response,
    data: T,
    meta: PaginationMeta,
    message = 'Data berhasil diambil.',
    code = 200,
  ): Response {
    return res.status(code).json({ success: true, code, message, data, meta });
  }

  /** Helper bikin objek meta dari hasil paginasi Prisma. */
  static buildMeta(totalItems: number, page: number, perPage: number): PaginationMeta {
    return {
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
      totalItems,
      itemsPerPage: perPage,
    };
  }
}
