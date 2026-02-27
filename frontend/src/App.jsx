import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'sonner';
import {
  fetchCycles, createCycle, deleteCycle, lockCycle, unlockCycle, updateCycleWeeks,
  fetchGrid, findCombinations, bookSlot, unbookSlot, resetAllBookings, exportCycle,
  getContactById, searchContactByName, updateCourseCodes,
  checkAuth, logout,
} from './api';
import LoginPage from './components/LoginPage';
import CycleTabs from './components/CycleTabs';
import FilterBar from './components/FilterBar';
import SearchCriteriaForm from './components/SearchCriteriaForm';
import BookingSection from './components/BookingSection';
import SearchResults from './components/SearchResults';
import AvailabilityGrid from './components/AvailabilityGrid';
import StudentInfoDialog from './components/StudentInfoDialog';
import CellBookingDialog from './components/CellBookingDialog';
import RegistrationList from './components/RegistrationList';
import AnalyticsDashboard from './components/AnalyticsDashboard';

export default function App() {
  // Auth state
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => {
    checkAuth().then(setAuthenticated);

    const handleUnauthorized = () => setAuthenticated(false);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = async () => {
    await logout();
    setAuthenticated(false);
  };

  // Cycle state
  const [cycles, setCycles] = useState([]);
  const [activeCycleId, setActiveCycleId] = useState(null);

  // View state: 'grid' or 'registration'
  const [currentView, setCurrentView] = useState('grid');

  // Filter state
  const [filters, setFilters] = useState({ shift: 'AM', labType: 'REGULAR', side: 'ALL' });

  // Grid & search state
  const [gridData, setGridData] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState({ startWeek: 1, endWeek: 12, weeksNeeded: 2 });
  const [results, setResults] = useState([]);
  const [selectedCombination, setSelectedCombination] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);

  // Booking state
  const [traineeName, setTraineeName] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState('');

  // Dialog state
  const [cellBookingDialog, setCellBookingDialog] = useState(null);
  const [cellBookingName, setCellBookingName] = useState('');
  const [cellSelectedContact, setCellSelectedContact] = useState(null);
  const [studentInfoDialog, setStudentInfoDialog] = useState(null);

  // Derived: is the active cycle locked?
  const activeCycle = cycles.find(c => c.id === activeCycleId);
  const isLocked = activeCycle?.locked ?? false;

  // Load cycles on mount
  useEffect(() => {
    (async () => {
      const data = await fetchCycles();
      setCycles(data);
      if (data.length > 0) {
        // Select the first (most recent) cycle
        setActiveCycleId(data[0].id);
      }
    })();
  }, []);

  // Reload grid when cycle or filters change
  useEffect(() => {
    if (!activeCycleId) return;
    loadGrid();
  }, [activeCycleId, filters]);

  const loadGrid = useCallback(async () => {
    if (!activeCycleId) return;
    const data = await fetchGrid(activeCycleId, filters.shift, filters.labType, filters.side);
    setGridData(data);
  }, [activeCycleId, filters]);

  // --- Cycle handlers ---
  const handleCreateCycle = async (year, courseCodes = []) => {
    const newCycle = await createCycle(year, courseCodes);
    const refreshed = await fetchCycles();
    setCycles(refreshed);
    setActiveCycleId(newCycle.id);
  };

  const handleUpdateCourseCodes = async (cycleId, courseCodes) => {
    const updated = await updateCourseCodes(cycleId, courseCodes);
    setCycles(prev => prev.map(c => c.id === cycleId ? { ...c, courseCodes: updated.courseCodes } : c));
  };

  const handleDeleteCycle = async (cycleId) => {
    await deleteCycle(cycleId);
    const refreshed = await fetchCycles();
    setCycles(refreshed);
    // If we deleted the active cycle, switch to the first remaining one
    if (cycleId === activeCycleId) {
      setActiveCycleId(refreshed.length > 0 ? refreshed[0].id : null);
      setGridData(null);
    }
  };

  const handleLockCycle = async (cycleId) => {
    await lockCycle(cycleId);
    setCycles(prev => prev.map(c => c.id === cycleId ? { ...c, locked: true } : c));
  };

  const handleUnlockCycle = async (cycleId) => {
    await unlockCycle(cycleId);
    setCycles(prev => prev.map(c => c.id === cycleId ? { ...c, locked: false } : c));
  };

  const handleUpdateWeekDates = async (cycleId, weeks) => {
    try {
      const updatedCycle = await updateCycleWeeks(cycleId, weeks);
      setCycles(prev => prev.map(c => c.id === cycleId ? updatedCycle : c));
      await loadGrid();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update week dates.');
    }
  };

  // --- Search handler ---
  const handleSearch = useCallback(async () => {
    if (!activeCycleId) return;
    setIsLoading(true);
    setError(null);
    setBookingSuccess('');
    setResults([]);
    setSelectedCombination(null);
    try {
      const combinations = await findCombinations({
        cycleId: activeCycleId,
        shift: filters.shift,
        labType: filters.labType,
        side: filters.side,
        ...searchCriteria,
      });
      setResults(combinations);
    } catch (err) {
      setError('Failed to search for availability. Please try again.');
    }
    setIsLoading(false);
  }, [activeCycleId, filters, searchCriteria]);

  const handleSelectCombination = useCallback(async (combination) => {
    setSelectedCombination(combination);
  }, []);

  // --- Search criteria handler ---
  const handleCriteriaChange = (e) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? parseInt(value, 10) : value;
    setSearchCriteria(prev => {
      const updated = { ...prev, [name]: newValue };
      if (name === 'startWeek' && prev.endWeek < newValue) {
        updated.endWeek = newValue;
      }
      return updated;
    });
  };

  // --- Booking handlers ---
  const handleBookSlot = async () => {
    if (!selectedCombination || !traineeName || !activeCycleId) {
      setError('Please select a slot and enter a trainee name to book.');
      return;
    }
    setIsBooking(true);
    setError(null);
    setBookingSuccess('');
    try {
      await bookSlot({
        cycleId: activeCycleId,
        stationId: selectedCombination.stationId,
        shift: filters.shift,
        weeks: selectedCombination.weeks,
        traineeName,
        contactId: selectedContact?.id,
      });
      setBookingSuccess(`Successfully booked ${selectedCombination.lab} - Station ${selectedCombination.station} for ${traineeName}.`);
      setSelectedCombination(null);
      setTraineeName('');
      setSelectedContact(null);
      await loadGrid();
      await handleSearch();
    } catch (err) {
      setError(err.response?.data?.error || 'An unexpected error occurred during booking.');
    }
    setIsBooking(false);
  };

  // --- Grid interaction handlers ---
  const handleShowStudentInfo = useCallback(async ({ stationId, week }) => {
    if (!gridData) return;
    const row = gridData.grid.find(r => r.stationId === stationId);
    if (!row) return;

    const weekIndex = gridData.weeks.indexOf(week);
    const rawValue = row.availability[weekIndex];
    if (!rawValue || rawValue === '\u2713' || rawValue === '\u2717') return;

    setStudentInfoDialog({
      stationId,
      stationLabel: row.station,
      shift: gridData.shift,
      week,
      studentName: rawValue,
      loading: true,
      hubspotContact: null,
    });

    try {
      let contact = await searchContactByName(rawValue);
      if (!contact && rawValue.includes(' ')) {
        const nameParts = rawValue.trim().split(/\s+/);
        if (nameParts[0]) contact = await searchContactByName(nameParts[0]);
        if (!contact && nameParts[nameParts.length - 1]) contact = await searchContactByName(nameParts[nameParts.length - 1]);
      }
      setStudentInfoDialog(prev => prev ? { ...prev, loading: false, hubspotContact: contact } : null);
    } catch {
      setStudentInfoDialog(prev => prev ? { ...prev, loading: false } : null);
    }
  }, [gridData]);

  const handleUnbook = useCallback(async ({ stationId, shift, week }) => {
    if (!activeCycleId) return;
    try {
      await unbookSlot({ cycleId: activeCycleId, stationId, shift, weeks: [week] });
      await loadGrid();
      setStudentInfoDialog(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unbook slot.');
    }
  }, [activeCycleId, loadGrid]);

  const handleUnbookMany = useCallback(async ({ stationId, shift, weeks }) => {
    if (!activeCycleId) return;
    try {
      await unbookSlot({ cycleId: activeCycleId, stationId, shift, weeks });
      await loadGrid();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unbook selected slots.');
    }
  }, [activeCycleId, loadGrid]);

  const handleBookCell = useCallback(({ stationId, shift, weeks }) => {
    if (!gridData) return;
    const row = gridData.grid.find(r => r.stationId === stationId);
    setCellBookingDialog({ stationId, stationLabel: row?.station || `Station ${stationId}`, shift, weeks });
    setCellBookingName('');
    setCellSelectedContact(null);
  }, [gridData]);

  const handleCellBookingSubmit = useCallback(async () => {
    if (!cellBookingDialog || !cellBookingName.trim() || !activeCycleId) {
      setError('Please enter a trainee name.');
      return;
    }
    try {
      setIsBooking(true);
      setError(null);
      await bookSlot({
        cycleId: activeCycleId,
        stationId: cellBookingDialog.stationId,
        shift: cellBookingDialog.shift,
        weeks: cellBookingDialog.weeks,
        traineeName: cellBookingName.trim(),
        contactId: cellSelectedContact?.id,
      });
      const weeksText = cellBookingDialog.weeks.length > 1
        ? `weeks ${cellBookingDialog.weeks.join(', ')}`
        : `week ${cellBookingDialog.weeks[0]}`;
      setBookingSuccess(`Successfully booked ${cellBookingDialog.stationLabel} for ${weeksText}!`);
      setCellBookingDialog(null);
      setCellBookingName('');
      setCellSelectedContact(null);
      await loadGrid();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to book slot.');
    } finally {
      setIsBooking(false);
    }
  }, [cellBookingDialog, cellBookingName, activeCycleId, loadGrid, cellSelectedContact]);

  const handleExport = async () => {
    if (!activeCycleId) return;
    try {
      await exportCycle(activeCycleId, filters);
    } catch (err) {
      setError('Failed to export data.');
    }
  };

  const handleClearAll = async () => {
    if (!activeCycleId) return;
    try {
      await resetAllBookings(activeCycleId);
      await loadGrid();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clear all bookings.');
    }
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (authenticated === false) {
    return <LoginPage onLoginSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="bg-gray-50 min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Lab Availability Manager</h1>
            <p className="text-slate-600 mt-1">Find and book available lab stations for trainees.</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('analytics')}
              className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                currentView === 'analytics'
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'text-gray-600 hover:text-gray-900 border-gray-300 hover:bg-gray-100'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Logout
            </button>
            <img src="/logo.svg" alt="Prep Doctors" className="h-12" />
          </div>
        </header>

        {currentView === 'analytics' ? (
          <AnalyticsDashboard
            cycles={cycles}
            onBack={() => setCurrentView('grid')}
          />
        ) : (
          <>
            {/* Cycle tabs */}
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

            {/* View toggle */}
            <div className="mb-4 flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setCurrentView('grid')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentView === 'grid'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Seating Grid
              </button>
              <button
                onClick={() => setCurrentView('registration')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  currentView === 'registration'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Registration List
              </button>
            </div>

            {currentView === 'grid' ? (
              <>
                {/* Filter bar */}
                <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <FilterBar filters={filters} onChange={setFilters} />
                </div>

                {/* Top row: Search + Booking + Results side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200">
                    <h2 className="text-lg font-semibold text-slate-800 mb-3">Search Criteria</h2>
                    <SearchCriteriaForm
                      criteria={searchCriteria}
                      onInputChange={handleCriteriaChange}
                      onSearch={handleSearch}
                      isLoading={isLoading}
                    />
                  </div>
                  <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200">
                    <BookingSection
                      traineeName={traineeName}
                      onTraineeNameChange={e => setTraineeName(e.target.value)}
                      selectedContact={selectedContact}
                      onContactSelect={setSelectedContact}
                      onBook={handleBookSlot}
                      isBooking={isBooking}
                      selectedCombination={selectedCombination}
                      error={error}
                      successMessage={bookingSuccess}
                      locked={isLocked}
                    />
                  </div>
                  <div>
                    <SearchResults
                      results={results}
                      selected={selectedCombination}
                      onSelect={handleSelectCombination}
                      isLoading={isLoading}
                      isCollapsed={isResultsCollapsed}
                      onToggleCollapse={() => setIsResultsCollapsed(!isResultsCollapsed)}
                    />
                  </div>
                </div>

                {/* Full-width grid below — always visible */}
                <AvailabilityGrid
                  data={gridData}
                  selectedCombination={selectedCombination}
                  onBookCell={handleBookCell}
                  onUnbookMany={handleUnbookMany}
                  onShowStudentInfo={handleShowStudentInfo}
                  onExport={handleExport}
                  onClearAll={handleClearAll}
                  onUpdateWeekDates={handleUpdateWeekDates}
                  locked={isLocked}
                />
              </>
            ) : (
              <RegistrationList
                cycleId={activeCycleId}
                cycleName={activeCycle?.name || ''}
                courseCodes={activeCycle?.courseCodes || []}
                onUpdateCourseCodes={handleUpdateCourseCodes}
              />
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <CellBookingDialog
        dialog={cellBookingDialog}
        cellBookingName={cellBookingName}
        setCellBookingName={setCellBookingName}
        selectedContact={cellSelectedContact}
        onContactSelect={setCellSelectedContact}
        onSubmit={handleCellBookingSubmit}
        onCancel={() => { setCellBookingDialog(null); setCellBookingName(''); setCellSelectedContact(null); }}
        isBooking={isBooking}
      />
      <StudentInfoDialog
        dialog={studentInfoDialog}
        onUnbook={handleUnbook}
        onClose={() => setStudentInfoDialog(null)}
        locked={isLocked}
      />
      <Toaster richColors position="top-right" />
    </div>
  );
}
