import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { FirstRunSetupPage } from '../features/auth/pages/FirstRunSetupPage';

















import { ActivationPage } from '../features/activation/ActivationPage';
const POSPage = lazy(() => import('../features/pos/pages/POSPage').then((m) => ({ default: m.POSPage })));
const OrdersPage = lazy(() => import('../features/orders/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const InvoicesPage = lazy(() => import('../features/invoices/pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const ProductsPage = lazy(() => import('../features/products/pages/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const CategoriesPage = lazy(() => import('../features/categories/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const CustomersPage = lazy(() => import('../features/customers/pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const DeliveryPage = lazy(() => import('../features/delivery/pages/DeliveryPage').then((m) => ({ default: m.DeliveryPage })));
const TablesPage = lazy(() => import('../features/tables/pages/TablesPage').then((m) => ({ default: m.TablesPage })));
const InventoryPage = lazy(() => import('../features/inventory/pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const CashRegisterPage = lazy(() => import('../features/cash-register/pages/CashRegisterPage').then((m) => ({ default: m.CashRegisterPage })));
const ShiftsPage = lazy(() => import('../features/shifts/pages/ShiftsPage').then((m) => ({ default: m.ShiftsPage })));
const ExpensesPage = lazy(() => import('../features/expenses/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const ReportsPage = lazy(() => import('../features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const UsersPage = lazy(() => import('../features/users/pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const SettingsPage = lazy(() => import('../features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BackupPage = lazy(() => import('../features/backup/pages/BackupPage').then((m) => ({ default: m.BackupPage })));
const Loading = () => <div className="p-6 text-sm text-[#64748B]">جاري تحميل الصفحة...</div>;
const Load = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<Loading />}>{children}</Suspense>;

export const router = createBrowserRouter([
  {
    path: '/activation',
    element: <ActivationPage onActivated={() => window.location.assign('/')} />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/setup',
    element: <FirstRunSetupPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/pos" replace />,
      },
      {
        path: 'pos',
        element: (
          <ProtectedRoute requiredPermission="pos.view_menu">
            <Load><POSPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute requiredPermission="orders.view">
            <Load><OrdersPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'invoices',
        element: (
          <ProtectedRoute requiredPermission="orders.view">
            <Load><InvoicesPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'products',
        element: (
          <ProtectedRoute requiredPermission="products.view">
            <Load><ProductsPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'categories',
        element: (
          <ProtectedRoute requiredPermission="categories.manage">
            <Load><CategoriesPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'customers',
        element: (
          <ProtectedRoute requiredPermission="customers.view">
            <Load><CustomersPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'delivery',
        element: (
          <ProtectedRoute requiredPermission="orders.view">
            <Load><DeliveryPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'tables',
        element: (
          <ProtectedRoute requiredPermission="pos.create_order">
            <Load><TablesPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventory',
        element: (
          <ProtectedRoute requiredPermission="inventory.view">
            <Load><InventoryPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'cash-register',
        element: (
          <ProtectedRoute requiredPermission="cash.view">
            <Load><CashRegisterPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'shifts',
        element: (
          <ProtectedRoute requiredPermission="shifts.view">
            <Load><ShiftsPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'expenses',
        element: (
          <ProtectedRoute requiredPermission="expenses.view">
            <Load><ExpensesPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredPermission="reports.sales">
            <Load><ReportsPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute requiredPermission="users.manage">
            <Load><UsersPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: (
          <ProtectedRoute requiredPermission="settings.view">
            <Load><SettingsPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: 'backup',
        element: (
          <ProtectedRoute requiredPermission="system.backup">
            <Load><BackupPage /></Load>
          </ProtectedRoute>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/pos" replace />,
      },
    ],
  },
]);
