import React, { useState, useCallback } from 'react';
import { useScheduleStore } from '../stores/scheduleStore';
import { useCycles, useUpdateWeeks } from '../hooks/useCycles';
import { useGrid } from '../hooks/useGrid';
import {
  useBookSlot,
  useUnbookSlot,
  useResetBookings,
  useFindCombinations,
} from '../hooks/useBookings';
import { searchContactByName, exportCycle } from '../api';
import FilterBar from './FilterBar';
import SearchCriteriaForm from './SearchCriteriaForm';
import BookingSection from './BookingSection';
import SearchResults from './SearchResults';
import AvailabilityGrid from './AvailabilityGrid';
import StudentInfoDialog from './StudentInfoDialog';
import CellBookingDialog from './CellBookingDialog';

export default function ScheduleView() {
  const { activeCycleId, filters, searchCriteria, selectedCombination, setSelectedCombination } =
    useScheduleStore();

  const { data: cycles = [] } = useCycles();
  const activeCycle = cycles.find((c) => c.id === activeCycleId);
  const isLocked = activeCycle?.locked ?? false;

  const { data: gridData } = useGrid(activeCycleId, filters);
  const updateWeeksMutation = useUpdateWeeks();
  const bookSlotMutation = useBookSlot();
  const unbookSlotMutation = useUnbookSlot();
  const resetBookingsMutation = useResetBookings();
  const findCombinationsMutation = useFindCombinations();

  const [results, setResults] = useState([]);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
  const [traineeName, setTraineeName] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [error, setError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [cellBookingDialog, setCellBookingDialog] = useState(null);
  const [studentInfoDialog, setStudentInfoDialog] = useState(null);

  const handleSearch = useCallback(async () => {
    if (!activeCycleId) return;
    setError(null);
    setBookingSuccess('');
    setResults([]);
    setSelectedCombination(null);
    try {
      const combinations = await findCombinationsMutation.mutateAsync({
        cycleId: activeCycleId,
        shift: filters.shift,
        labType: filters.labType,
        side: filters.side,
        ...searchCriteria,
      });
      setResults(combinations);
    } catch {
      setError('Failed to search for availability. Please try again.');
    }
  }, [activeCycleId, filters, searchCriteria, setSelectedCombination]);

  const handleBookSlot = async () => {
    if (!selectedCombination || !traineeName || !activeCycleId) {
      setError('Please select a slot and enter a trainee name to book.');
      return;
    }
    setError(null);
    setBookingSuccess('');
    try {
      await bookSlotMutation.mutateAsync({
        cycleId: activeCycleId,
        stationId: selectedCombination.stationId,
        shift: filters.shift,
        weeks: selectedCombination.weeks,
        traineeName,
        contactId: selectedContact?.id,
      });
      setBookingSuccess(
        `Successfully booked ${selectedCombination.lab} - Station ${selectedCombination.station} for ${traineeName}.`,
      );
      setSelectedCombination(null);
      setTraineeName('');
      setSelectedContact(null);
      await handleSearch();
    } catch (err) {
      setError(err.response?.data?.error || 'An unexpected error occurred during booking.');
    }
  };

  const handleShowStudentInfo = useCallback(
    async ({ stationId, week }) => {
      if (!gridData) return;
      const row = gridData.grid.find((r) => r.stationId === stationId);
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
          if (!contact && nameParts[nameParts.length - 1])
            contact = await searchContactByName(nameParts[nameParts.length - 1]);
        }
        setStudentInfoDialog((prev) =>
          prev ? { ...prev, loading: false, hubspotContact: contact } : null,
        );
      } catch {
        setStudentInfoDialog((prev) => (prev ? { ...prev, loading: false } : null));
      }
    },
    [gridData],
  );

  const handleUnbook = useCallback(
    async ({ stationId, shift, week }) => {
      if (!activeCycleId) return;
      try {
        await unbookSlotMutation.mutateAsync({
          cycleId: activeCycleId,
          stationId,
          shift,
          weeks: [week],
        });
        setStudentInfoDialog(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to unbook slot.');
      }
    },
    [activeCycleId, unbookSlotMutation],
  );

  const handleUnbookMany = useCallback(
    async ({ stationId, shift, weeks }) => {
      if (!activeCycleId) return;
      try {
        await unbookSlotMutation.mutateAsync({ cycleId: activeCycleId, stationId, shift, weeks });
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to unbook selected slots.');
      }
    },
    [activeCycleId, unbookSlotMutation],
  );

  const handleBookCell = useCallback(
    ({ stationId, shift, weeks }) => {
      if (!gridData) return;
      const row = gridData.grid.find((r) => r.stationId === stationId);
      setCellBookingDialog({
        stationId,
        stationLabel: row?.station || `Station ${stationId}`,
        shift,
        weeks,
      });
    },
    [gridData],
  );

  const handleCellBookingSubmit = async ({ traineeName: name, contactId }) => {
    if (!cellBookingDialog || !name.trim() || !activeCycleId) {
      setError('Please enter a trainee name.');
      return;
    }
    try {
      setError(null);
      await bookSlotMutation.mutateAsync({
        cycleId: activeCycleId,
        stationId: cellBookingDialog.stationId,
        shift: cellBookingDialog.shift,
        weeks: cellBookingDialog.weeks,
        traineeName: name.trim(),
        contactId,
      });
      const weeksText =
        cellBookingDialog.weeks.length > 1
          ? `weeks ${cellBookingDialog.weeks.join(', ')}`
          : `week ${cellBookingDialog.weeks[0]}`;
      setBookingSuccess(`Successfully booked ${cellBookingDialog.stationLabel} for ${weeksText}!`);
      setCellBookingDialog(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to book slot.');
    }
  };

  const handleUpdateWeekDates = async (cycleId, weeks) => {
    try {
      await updateWeeksMutation.mutateAsync({ cycleId, weeks });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update week dates.');
    }
  };

  const handleExport = async () => {
    if (!activeCycleId) return;
    try {
      await exportCycle(activeCycleId, filters);
    } catch {
      setError('Failed to export data.');
    }
  };

  const handleClearAll = async () => {
    if (!activeCycleId) return;
    try {
      await resetBookingsMutation.mutateAsync(activeCycleId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clear all bookings.');
    }
  };

  return (
    <>
      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <FilterBar />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Search Criteria</h2>
          <SearchCriteriaForm
            onSearch={handleSearch}
            isLoading={findCombinationsMutation.isPending}
          />
        </div>
        <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200">
          <BookingSection
            traineeName={traineeName}
            onTraineeNameChange={(e) => setTraineeName(e.target.value)}
            selectedContact={selectedContact}
            onContactSelect={setSelectedContact}
            onBook={handleBookSlot}
            isBooking={bookSlotMutation.isPending}
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
            onSelect={setSelectedCombination}
            isLoading={findCombinationsMutation.isPending}
            isCollapsed={isResultsCollapsed}
            onToggleCollapse={() => setIsResultsCollapsed(!isResultsCollapsed)}
          />
        </div>
      </div>

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

      <CellBookingDialog
        dialog={cellBookingDialog}
        onSubmit={handleCellBookingSubmit}
        onCancel={() => setCellBookingDialog(null)}
        isBooking={bookSlotMutation.isPending}
      />
      <StudentInfoDialog
        dialog={studentInfoDialog}
        onUnbook={handleUnbook}
        onClose={() => setStudentInfoDialog(null)}
        locked={isLocked}
      />
    </>
  );
}
