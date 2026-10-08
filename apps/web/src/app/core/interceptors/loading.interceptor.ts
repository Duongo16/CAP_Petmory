import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/**
 * Tu dong bat Loading Overlay khi co API request va tat khi hoan thanh.
 * Bo qua cac file dich i18n hoac tai nguyen tinh de khong bi chop tat.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Bo qua neu co header yeu cau khong hien loading
  if (req.headers.has('X-Skip-Loading')) {
    const cleanReq = req.clone({ headers: req.headers.delete('X-Skip-Loading') });
    return next(cleanReq);
  }

  // Bo qua cac file tinh nhu i18n json hoac manifest
  const url = req.url.toLowerCase();
  const isStaticResource = url.includes('/i18n/') || url.includes('/models/manifest.json') || url.endsWith('.svg') || url.endsWith('.png');
  if (isStaticResource) {
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
