import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Bucket {
  count: number;
  expiresAt: number;
}

/**
 * Padanan UserSecurityService::enforceRateLimit() (Laravel, dulu pakai
 * Cache::remember/put). Implementasi di sini in-memory (Map) supaya modul
 * ini bisa langsung jalan tanpa dependensi tambahan.
 *
 * PENTING: in-memory berarti counter TIDAK dibagi antar instance/pod.
 * Kalau nanti deploy > 1 instance NestJS di belakang load balancer, ganti
 * implementasi ini dengan Redis (mis. @nestjs-modules/ioredis) supaya
 * limitnya konsisten global — struktur method di bawah sengaja dibuat
 * generik supaya gampang di-swap.
 */
@Injectable()
export class RateLimiterService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000; // 1 menit, sama seperti kode lama
  private readonly maxAttempts: number;

  constructor(private readonly config: ConfigService) {
    this.maxAttempts = Number(this.config.get('AUTH_RATE_LIMIT_PER_MINUTE') ?? 10);
  }

  /** @returns true kalau masih boleh lanjut, false kalau sudah melebihi limit. */
  hit(ip: string, identifier: string): boolean {
    const key = `rate_limit:auth:${ip}:${identifier}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.expiresAt < now) {
      this.buckets.set(key, { count: 1, expiresAt: now + this.windowMs });
      return true;
    }

    if (bucket.count >= this.maxAttempts) {
      return false;
    }

    bucket.count += 1;
    return true;
  }
}
