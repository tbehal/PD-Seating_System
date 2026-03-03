import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ScheduleView from './components/ScheduleView';
import RegistrationList from './components/RegistrationList';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LoginPage from './components/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <ErrorBoundary>
        <LoginPage />
      </ErrorBoundary>
    ),
  },
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <AppLayout />
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <Navigate to="/schedule" replace /> },
      {
        path: 'schedule',
        element: (
          <ErrorBoundary>
            <ScheduleView />
          </ErrorBoundary>
        ),
      },
      {
        path: 'registration',
        element: (
          <ErrorBoundary>
            <RegistrationList />
          </ErrorBoundary>
        ),
      },
      {
        path: 'analytics',
        element: (
          <ErrorBoundary>
            <AnalyticsDashboard />
          </ErrorBoundary>
        ),
      },
    ],
  },
]);
