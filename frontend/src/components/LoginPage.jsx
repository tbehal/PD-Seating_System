import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '../schemas/login';
import { useAuthStore } from '../stores/authStore';
import { login } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const authenticated = useAuthStore((s) => s.authenticated);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: '' },
  });

  if (authenticated === true) {
    return <Navigate to="/schedule" replace />;
  }

  const onSubmit = async (data) => {
    setServerError('');
    try {
      await login(data.password);
      setAuthenticated(true);
      navigate('/schedule', { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.error || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-lg border border-border p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="Prep Doctors" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Lab Availability Manager</h1>
          <p className="text-muted-foreground mt-1 text-sm">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-secondary-foreground mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="Enter admin password"
              autoFocus
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div className="mb-4 p-3 bg-destructive-muted border border-destructive/30 rounded-lg text-destructive text-sm">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
