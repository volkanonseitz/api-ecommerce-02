export interface VerifyEmailTemplateData {
  userName: string;
  verifyUrl: string;
  appName: string;
  expiresInMinutes: number;
}

/**
 * Padanan view `emails.verify-email-mjml` (Blade+MJML) di
 * VerifyEmailNotification.php lama. Sumber MJML aslinya tidak ikut
 * di-share, jadi ini rekonstruksi HTML biasa dengan konten & struktur
 * yang setara (subject, tombol verifikasi, catatan kedaluwarsa) —
 * ganti isinya kalau desain email resmi sudah tersedia.
 */
export function renderVerifyEmailTemplate(data: VerifyEmailTemplateData): string {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="margin-bottom: 4px;">${data.appName}</h2>
    <p>Halo ${data.userName},</p>
    <p>Terima kasih sudah mendaftar. Klik tombol di bawah untuk memverifikasi alamat email Anda.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${data.verifyUrl}"
         style="background:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
        Verifikasi Email
      </a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Link ini berlaku selama ${data.expiresInMinutes} menit. Kalau tombolnya tidak bisa diklik, salin URL berikut ke browser:
      <br /><a href="${data.verifyUrl}">${data.verifyUrl}</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Kalau Anda tidak merasa mendaftar di ${data.appName}, abaikan saja email ini.
    </p>
  </div>`;
}
