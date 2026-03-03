import React, { useEffect } from 'react';
import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useScheduleStore } from '../stores/scheduleStore';
import {
  useCycles,
  useCreateCycle,
  useDeleteCycle,
  useLockCycle,
  useUnlockCycle,
} from '../hooks/useCycles';
import { checkAuth, logout } from '../api';
import CycleTabs from './CycleTabs';

export default function AppLayout() {
  const { authenticated, setAuthenticated } = useAuthStore();
  const { activeCycleId, setActiveCycleId } = useScheduleStore();
  const resetSchedule = useScheduleStore((s) => s.reset);
  const navigate = useNavigate();

  const { data: cycles = [] } = useCycles({ enabled: authenticated === true });
  const createCycleMutation = useCreateCycle();
  const deleteCycleMutation = useDeleteCycle();
  const lockCycleMutation = useLockCycle();
  const unlockCycleMutation = useUnlockCycle();

  useEffect(() => {
    if (cycles.length > 0 && !activeCycleId) {
      setActiveCycleId(cycles[0].id);
    }
  }, [cycles, activeCycleId, setActiveCycleId]);

  useEffect(() => {
    checkAuth().then(setAuthenticated);

    const handleUnauthorized = () => {
      setAuthenticated(false);
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [setAuthenticated, navigate]);

  const handleLogout = async () => {
    await logout();
    setAuthenticated(false);
    resetSchedule();
    navigate('/login', { replace: true });
  };

  const handleCreateCycle = async (year, courseCodes = []) => {
    await createCycleMutation.mutateAsync({ year, courseCodes });
  };

  const handleDeleteCycle = async (cycleId) => {
    await deleteCycleMutation.mutateAsync(cycleId);
    if (cycleId === activeCycleId) {
      const remaining = cycles.filter((c) => c.id !== cycleId);
      setActiveCycleId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleLockCycle = async (cycleId) => {
    await lockCycleMutation.mutateAsync(cycleId);
  };

  const handleUnlockCycle = async (cycleId) => {
    await unlockCycleMutation.mutateAsync(cycleId);
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (authenticated === false) {
    return <Navigate to="/login" replace />;
  }

  const navLinkClass = ({ isActive }) =>
    `px-3 py-1.5 text-sm border rounded-lg transition-colors ${
      isActive
        ? 'bg-brand-500 text-white border-brand-500'
        : 'text-gray-600 hover:text-gray-900 border-gray-300 hover:bg-gray-100'
    }`;

  return (
    <div className="bg-gray-50 min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Lab Availability Manager
            </h1>
            <p className="text-slate-600 mt-1">
              Find and book available lab stations for trainees.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <NavLink to="/schedule" className={navLinkClass}>
              Schedule
            </NavLink>
            <NavLink to="/registration" className={navLinkClass}>
              Registration
            </NavLink>
            <NavLink to="/analytics" className={navLinkClass}>
              Analytics
            </NavLink>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Logout
            </button>
            <img src="/logo.svg" alt="Prep Doctors" className="h-12" />
          </div>
        </header>

        <div className="mb-4">
          <CycleTabs
            cycles={cycles}
            activeCycleId={activeCycleId}
            onSelectCycle={setActiveCycleId}
            onCreateCycle={handleCreateCycle}
            onDeleteCycle={handleDeleteCycle}
            onLockCycle={handleLockCycle}
            onUnlockCycle={handleUnlockCycle}
          />
        </div>

        <Outlet />
      </div>
    </div>
  );
}
