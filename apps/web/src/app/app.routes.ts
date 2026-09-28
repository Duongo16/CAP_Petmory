import { Routes } from '@angular/router';
import {
  authGuard,
  operationsGuard,
  customerGuard,
  internalGuard,
} from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'login',
    canActivate: [customerGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'community',
        loadComponent: () =>
          import('./features/community/community-page').then((m) => m.CommunityPage),
      },
      {
        path: 'community/posts/:id',
        loadComponent: () =>
          import('./features/community/post-detail-page').then((m) => m.PostDetailPage),
      },
      {
        path: 'community/users/:id',
        loadComponent: () =>
          import('./features/community/profile-page').then((m) => m.CommunityProfilePage),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/catalog/products-page').then((m) => m.ProductsPage),
      },
      {
        path: 'products/:code',
        loadComponent: () =>
          import('./features/catalog/product-detail-page').then((m) => m.ProductDetailPage),
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
        path: 'pets',
        loadComponent: () => import('./features/pets/pets-page').then((m) => m.PetsPage),
      },
      {
        path: 'pets/:id/photos',
        loadComponent: () => import('./features/photos/photos-page').then((m) => m.PhotosPage),
      },
      {
        path: 'admin/orders',
        canActivate: [internalGuard],
        loadComponent: () =>
          import('./features/admin/admin-orders-page').then((m) => m.AdminOrdersPage),
      },
      {
        path: 'admin/orders/:orderCode',
        canActivate: [internalGuard],
        loadComponent: () =>
          import('./features/admin/admin-order-detail-page').then((m) => m.AdminOrderDetailPage),
      },
      {
        path: 'admin/orders/:orderCode/production-file',
        canActivate: [operationsGuard],
        loadComponent: () =>
          import('./features/admin/admin-production-page').then((m) => m.AdminProductionPage),
      },
      {
        path: 'admin/customers',
        canActivate: [internalGuard],
        loadComponent: () =>
          import('./features/admin/admin-customers-page').then((m) => m.AdminCustomersPage),
      },
      {
        path: 'admin/customers/:id',
        canActivate: [internalGuard],
        loadComponent: () =>
          import('./features/admin/admin-customer-detail-page').then(
            (m) => m.AdminCustomerDetailPage,
          ),
      },
      {
        path: 'admin/materials',
        canActivate: [operationsGuard],
        loadComponent: () =>
          import('./features/admin/admin-materials-page').then((m) => m.AdminMaterialsPage),
      },
      {
        path: 'admin/settings',
        canActivate: [operationsGuard],
        loadComponent: () =>
          import('./features/admin/admin-config-page').then((m) => m.AdminConfigPage),
      },
      {
        path: 'admin/payment-log',
        canActivate: [internalGuard],
        loadComponent: () =>
          import('./features/admin/admin-payments-page').then((m) => m.AdminPaymentsPage),
      },
      {
        path: 'colors',
        loadComponent: () => import('./features/catalog/colors-page').then((m) => m.ColorsPage),
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
