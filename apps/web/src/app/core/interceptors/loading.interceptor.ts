import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/**
 * Hiện Loading Overlay cho các thao tác ghi và tắt khi request hoàn tất.
 * Các request đọc dữ liệu dùng trạng thái riêng của từng màn hình để không
 * chặn toàn bộ giao diện khi một API nền trả lời chậm.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Bo qua neu co header yeu cau khong hien loading
  if (req.headers.has('X-Skip-Loading')) {
    const cleanReq = req.clone({ headers: req.headers.delete('X-Skip-Loading') });
    return next(cleanReq);
  }

  // Bỏ qua các file tĩnh như i18n json hoặc manifest.
  const url = req.url.toLowerCase();
  const isStaticResource = url.includes('/i18n/') || url.includes('/models/manifest.json') || url.endsWith('.svg') || url.endsWith('.png');
  const isReadOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  if (isStaticResource || isReadOnly) {
    return next(req);
  }

  const loading = inject(LoadingService);
  loading.show();

  return next(req).pipe(
    finalize(() => {
      loading.hide();
    }),
  );
};
