/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './features/auth/context/AuthContext';
import { ActivationGate } from './features/activation/ActivationGate';

export default function App() {
  return (
    <ActivationGate>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </ActivationGate>
  );
}
