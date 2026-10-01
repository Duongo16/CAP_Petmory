import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import {
  authGuard,
  managerGuard,
  accountAdminGuard,
  customerGuard,
  internalGuard,
} from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => (inject(AuthService).isSignedIn() ? 'home' : 'landing'),
  },
  {
    path: 'landing',
    canActivate: [customerGuard],
    loadComponent: () =>
      import('./features/home/guest-home-page').then((m) => m.GuestHomePage),
  },
  {
    path: 'login',
    canActivate: [customerGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [customerGuard],
    loadComponent: () => import('./features/auth/register').then((m) => m.RegisterPage),
  },
  /*
   * Ba duong duoi day nam ngoai lop kiem dang nhap, vi mot quyen nhat ky da
   * de cong khai thi phai doc duoc that su, ke ca khi nguoi doc chua tung co
   * tai khoan o day.
   */
  {
    path: 'diaries',
    loadComponent: () =>
      import('./features/public-diary/diary-list-page').then((m) => m.DiaryListPage),
  },
  {
    path: 'diaries/:petId',
    loadComponent: () =>
      import('./features/public-diary/diary-book-page').then((m) => m.DiaryBookPage),
  },
  {
    path: 'd/:code',
    loadComponent: () =>
      import('./features/public-diary/diary-book-page').then((m) => m.DiaryBookPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/today/today-page').then((m) => m.TodayPage),
      },
      {
        path: 'community',
        loadComponent: () =>
          import('./features/community/community-page').then((m) => m.CommunityPage),
      },
      {
        // Bai viet nay mo thanh popup tren dong tin, nen link cu dua ve do.
        path: 'community/posts/:id',
        pathMatch: 'full',
        redirectTo: ({ params }) =>
          inject(Router).createUrlTree(['/community'], { queryParams: { post: params['id'] } }),
      },
      {
        path: 'community/users/:id',
        loadComponent: () =>
          import('./features/community/profile-page').then((m) => m.CommunityProfilePage),
      },
      {
        path: 'shop',
        loadComponent: () => import('./features/shop/shop-page').then((m) => m.ShopPage),
      },
      // Products and ready-made goods now share the shop, and details open as a popup there.
      {
        path: 'products',
        pathMatch: 'full',
        redirectTo: () => inject(Router).createUrlTree(['/shop'], { queryParams: { tab: 'custom' } }),
      },
      {
        path: 'goods',
        pathMatch: 'full',
        redirectTo: () => inject(Router).createUrlTree(['/shop'], { queryParams: { tab: 'ready' } }),
      },
      {
        path: 'products/:code',
        redirectTo: ({ params }) =>
          inject(Router).createUrlTree(['/shop'], { queryParams: { tab: 'custom', product: params['code'] } }),
      },
      {
        path: 'goods/:code',
        redirectTo: ({ params }) =>
          inject(Router).createUrlTree(['/shop'], { queryParams: { tab: 'ready', goods: params['code'] } }),
      },
      {
        path: 'cart',
        loadComponent: () => import('./features/cart/cart-page').then((m) => m.CartPage),
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./features/orders/checkout-page').then((m) => m.CheckoutPage),
      },
      {
        path: 'payments/:orderCode',
        loadComponent: () => import('./features/orders/payment-page').then((m) => m.PaymentPage),
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/orders-page').then((m) => m.OrdersPage),
      },
      {
        path: 'studio',
        loadComponent: () => import('./features/studio/studio-page').then((m) => m.StudioPage),
      },
      {
        path: 'suggest',
        loadComponent: () =>
          import('./features/studio/suggest-page').then((m) => m.SuggestPage),
      },
      {
        path: 'restore',
        loadComponent: () =>
          import('./features/restore/restore-page').then((m) => m.RestorePage),
      },
      {
        path: 'pets',
        loadComponent: () => import('./features/pets/pets-page').then((m) => m.PetsPage),
      },
      { path: 'today', redirectTo: 'home', pathMatch: 'full' },
      {
        // The record now opens as a popup over the list, so old links land there.
        path: 'pets/:id',
        pathMatch: 'full',
        redirectTo: ({ params }) =>
          inject(Router).createUrlTree(['/pets'], { queryParams: { open: params['id'] } }),
      },
      {
        // Anh cua be nay nam trong tab Anh cua nhat ky, nen link cu dua ve do.
        path: 'pets/:id/photos',
        pathMatch: 'full',
        redirectTo: ({ params }) =>
          inject(Router).createUrlTree(['/pets', params['id'], 'journal'], { queryParams: { view: 'photos' } }),
      },
      {
        path: 'pets/:id/slideshow',
        loadComponent: () =>
          import('./features/memories/slideshow-page').then((m) => m.SlideshowPage),
      },
      {
        path: 'journals',
        loadComponent: () =>
          import('./features/memories/bookshelf/bookshelf-page').then((m) => m.BookshelfPage),
      },
      {
        path: 'pets/:id/journal',
        loadComponent: () =>
          import('./features/memories/memories-page').then((m) => m.MemoriesPage),
      },
      { path: 'pets/:id/story', redirectTo: 'pets/:id/journal' },
      {
        // The internal screens share a side rail, so they sit inside one frame.
        path: 'admin',
        canActivate: [internalGuard],
        loadComponent: () =>
          import('./features/admin/admin-shell/admin-shell').then((m) => m.AdminShell),
        children: [
          {
            /*
             * Mo khu noi bo thi di thang toi cho tai khoan lam viec duoc.
             *
             * Nhom Quan ly vao ban dieu phoi don, nhom Quan tri vien vao man
             * quan ly tai khoan. De cung mot dich cho ca hai thi mot nhom se
             * bi day ra ngay khi vua vao.
             */
            path: '',
            pathMatch: 'full',
            redirectTo: () => (inject(AuthService).isManager() ? 'orders' : 'accounts'),
          },
          {
            path: 'orders',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-orders-page').then((m) => m.AdminOrdersPage),
          },
          {
            path: 'orders/:orderCode',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-order-detail-page').then(
                (m) => m.AdminOrderDetailPage,
              ),
          },
          {
            path: 'orders/:orderCode/production-file',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-production-page').then((m) => m.AdminProductionPage),
          },
          {
            path: 'customers',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-customers-page').then((m) => m.AdminCustomersPage),
          },
          {
            path: 'customers/:id',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-customer-detail-page').then(
                (m) => m.AdminCustomerDetailPage,
              ),
          },
          {
            /*
             * Bao cao mo cho hai nhom van hanh. Nhom Cham soc khach hang bi
             * dua ve trang chu ngay tai day, va may chu van tu choi mot lan
             * nua neu ai do goi thang vao duong do.
             */
            path: 'reports',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-reports-page').then((m) => m.AdminReportsPage),
          },
          {
            path: 'goods',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-goods-page').then((m) => m.AdminGoodsPage),
          },
          {
            path: 'materials',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-materials-page').then((m) => m.AdminMaterialsPage),
          },
          {
            path: 'models',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-models-page').then((m) => m.AdminModelsPage),
          },
          {
            path: 'settings',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-config-page').then((m) => m.AdminConfigPage),
          },
          {
            /*
             * Truc hoi thoai mo cho ca ba nhom noi bo. Nhom Cham soc khach
             * hang la nguoi truc chinh, hai nhom con lai vao duoc de do khi
             * can, dung nhu may chu cho phep.
             */
            path: 'chats',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-chats-page').then((m) => m.AdminChatsPage),
          },
          {
            path: 'payment-log',
            canActivate: [managerGuard],
            loadComponent: () =>
              import('./features/admin/admin-payments-page').then((m) => m.AdminPaymentsPage),
          },
          {
            /*
             * Quan ly tai khoan la ranh gioi cua ba nhom quyen: chi nhom Quan
             * tri vien vao duoc, va nhom do khong mo duoc man hinh nao khac.
             */
            path: 'accounts',
            canActivate: [accountAdminGuard],
            loadComponent: () =>
              import('./features/admin/admin-accounts-page').then((m) => m.AdminAccountsPage),
          },
        ],
      },
      {
        path: 'colors',
        loadComponent: () => import('./features/catalog/colors-page').then((m) => m.ColorsPage),
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
