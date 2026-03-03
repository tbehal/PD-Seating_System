import React, { useState, useRef, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

// Format a date string like "2026-01-06" to short format like "Jan 6"
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Format week header label with optional date range
function weekLabel(week, weekDates) {
  const wd = weekDates?.find((w) => w.week === week);
  if (wd?.startDate && wd?.endDate) {
    const start = formatShortDate(wd.startDate);
    const end = formatShortDate(wd.endDate);
    return { label: `W${week}`, dateRange: `${start}-${end}` };
  }
  return { label: `W${week}`, dateRange: null };
}

export default function AvailabilityGrid({
  data,
  selectedCombination,
  onBookCell,
  onUnbookMany,
  onShowStudentInfo,
  onExport,
  onClearAll,
  onUpdateWeekDates,
  locked,
}) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedCells, setSelectedCells] = useState([]);
  const [selectionStart, setSelectionStart] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(null); // 'book' | 'unbook' | null
  const [didDrag, setDidDrag] = useState(false);
  const [editingWeek, setEditingWeek] = useState(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const popoverRef = useRef(null);
  const clearConfirmRef = useRef(null);

  useFocusTrap(clearConfirmRef, showClearConfirm, { onEscape: () => setShowClearConfirm(false) });

  // Close popover on outside click
  useEffect(() => {
    if (!editingWeek) return;
    const handleClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setEditingWeek(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [editingWeek]);

  const handleWeekHeaderClick = (week) => {
    if (locked) return;
    const wd = data.weekDates?.find((w) => w.week === week);
    setEditingWeek(week);
    setEditStartDate(wd?.startDate ? wd.startDate.split('T')[0] : '');
    setEditEndDate(wd?.endDate ? wd.endDate.split('T')[0] : '');
  };

  const handleSaveWeekDates = () => {
    if (!editingWeek || !onUpdateWeekDates) return;
    onUpdateWeekDates(data.cycleId, [
      { week: editingWeek, startDate: editStartDate || null, endDate: editEndDate || null },
    ]);
    setEditingWeek(null);
  };

  // Show empty placeholder when no data yet (after hooks)
  if (!data) {
    return (
      <div className="bg-card rounded-xl shadow-md border border-border p-8 text-center text-muted-foreground/60">
        <p className="text-lg">Select a cycle to view the availability grid</p>
      </div>
    );
  }

  const handleMouseDown = (stationId, week, isAvailable, isBooked) => {
    if (locked && !isBooked) return; // locked: only allow clicking booked to view info
    if (isAvailable || isBooked) {
      setIsSelecting(true);
      setSelectionStart({ stationId, week });
      setSelectionMode(isBooked ? 'unbook' : 'book');
      setSelectedCells([{ stationId, week }]);
      setDidDrag(false);
    }
  };

  const handleMouseEnter = (stationId, week, isAvailable, isBooked) => {
    if (locked) return;
    if (isSelecting && selectionStart && selectionMode) {
      if (stationId === selectionStart.stationId) {
        const cellMatchesMode = selectionMode === 'book' ? isAvailable : isBooked;
        if (!cellMatchesMode) return;

        const startWeek = Math.min(selectionStart.week, week);
        const endWeek = Math.max(selectionStart.week, week);
        const newSelection = [];
        for (let w = startWeek; w <= endWeek; w++) {
          newSelection.push({ stationId, week: w });
        }
        setSelectedCells(newSelection);
        if (week !== selectionStart.week) setDidDrag(true);
      }
    }
  };

  const handleMouseUp = () => {
    // Single click on booked cell: show info
    if (selectionMode === 'unbook' && !didDrag && selectedCells.length === 1) {
      const only = selectedCells[0];
      onShowStudentInfo({ stationId: only.stationId, week: only.week });
      clearSelection();
      return;
    }
    setIsSelecting(false);
  };

  const clearSelection = () => {
    setSelectedCells([]);
    setSelectionStart(null);
    setSelectionMode(null);
    setIsSelecting(false);
    setDidDrag(false);
  };

  const confirmSelection = () => {
    if (!selectionMode || selectedCells.length === 0) return;
    const payload = {
      stationId: selectedCells[0].stationId,
      shift: data.shift,
      weeks: selectedCells.map((cell) => cell.week),
    };
    if (selectionMode === 'book') {
      onBookCell(payload);
    } else if (selectionMode === 'unbook') {
      onUnbookMany(payload);
    }
    clearSelection();
  };

  const isCellSelected = (stationId, week) => {
    return selectedCells.some((cell) => cell.stationId === stationId && cell.week === week);
  };

  // Filter grid based on search query
  const filteredGrid = searchQuery.trim()
    ? data.grid.filter((row) =>
        row.availability.some(
          (status) =>
            typeof status === 'string' &&
            status !== '\u2713' &&
            status !== '\u2717' &&
            status.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      )
    : data.grid;

  // Group by lab name for visual grouping
  let lastLabName = null;

  return (
    <div
      className="bg-card rounded-xl shadow-md border border-border"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">
            Availability Grid
            {locked && <span className="ml-2 text-sm text-warning font-normal">(Read-only)</span>}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Export CSV
            </button>
            {!locked && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-4 py-2 bg-destructive text-primary-foreground rounded-md hover:bg-destructive/90 transition-colors text-sm font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search for student in grid..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Drag selection toolbar */}
        {selectedCells.length > 0 && !locked && (
          <div className="mt-3 p-2 bg-warning-muted border border-warning/30 rounded-md flex items-center justify-between gap-2">
            <div className="text-sm text-foreground">
              {selectionMode === 'book' ? 'Selected available weeks' : 'Selected booked weeks'}:{' '}
              {selectedCells.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmSelection}
                className={`px-3 py-1 rounded-md text-primary-foreground text-sm font-medium ${
                  selectionMode === 'book'
                    ? 'bg-primary hover:bg-primary/90'
                    : 'bg-destructive hover:bg-destructive/90'
                }`}
              >
                {selectionMode === 'book' ? 'Book Selected' : 'Clear Selected'}
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80"
              >
                Cancel Selection
              </button>
            </div>
          </div>
        )}

        {searchQuery && (
          <p className="text-sm text-muted-foreground">
            Found {filteredGrid.length} station(s) with "{searchQuery}"
          </p>
        )}
      </div>

      <div className="overflow-x-auto p-2">
        <table
          className="min-w-full border-collapse text-center"
          style={{ tableLayout: 'fixed', userSelect: 'none' }}
        >
          <thead>
            <tr>
              <th
                className="p-2 text-left text-sm font-semibold text-muted-foreground"
                style={{ width: '160px' }}
              >
                Station
              </th>
              {data.weeks.map((w) => {
                const { label, dateRange } = weekLabel(w, data.weekDates);
                return (
                  <th
                    key={w}
                    className={`p-2 text-sm font-semibold text-muted-foreground relative ${!locked ? 'cursor-pointer hover:bg-muted' : ''}`}
                    style={{ width: '100px' }}
                    onClick={() => handleWeekHeaderClick(w)}
                    title={!locked ? 'Click to set week dates' : undefined}
                  >
                    <div>{label}</div>
                    {dateRange && (
                      <div className="text-xs font-normal text-muted-foreground/60">
                        {dateRange}
                      </div>
                    )}
                    {editingWeek === w && (
                      <div
                        ref={popoverRef}
                        className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-card border border-input rounded-lg shadow-lg p-3 w-56"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-left text-xs font-semibold text-secondary-foreground mb-2">
                          Week {w} Dates
                        </div>
                        <label
                          htmlFor={`week-${w}-start`}
                          className="block text-left text-xs text-muted-foreground mb-1"
                        >
                          Start Date
                        </label>
                        <input
                          id={`week-${w}-start`}
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className="w-full px-2 py-1 border border-input rounded text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <label
                          htmlFor={`week-${w}-end`}
                          className="block text-left text-xs text-muted-foreground mb-1"
                        >
                          End Date
                        </label>
                        <input
                          id={`week-${w}-end`}
                          type="date"
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          className="w-full px-2 py-1 border border-input rounded text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveWeekDates}
                            className="flex-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingWeek(null)}
                            className="flex-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs font-medium hover:bg-secondary/80"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredGrid.map((row) => {
              // Lab group separator
              const showLabHeader = row.labName !== lastLabName;
              lastLabName = row.labName;

              const isStationMatch =
                selectedCombination && selectedCombination.stationId === row.stationId;

              return (
                <React.Fragment key={row.stationId}>
                  {showLabHeader && (
                    <tr>
                      <td
                        colSpan={data.weeks.length + 1}
                        className="p-2 bg-muted text-left text-sm font-bold text-secondary-foreground border-t-2 border-input"
                      >
                        {row.labName}
                      </td>
                    </tr>
                  )}
                  <tr className="odd:bg-card even:bg-muted/50">
                    <td
                      className={`p-2 border border-border font-bold text-left ${isStationMatch ? 'text-primary' : 'text-secondary-foreground'}`}
                    >
                      {row.station}
                    </td>
                    {row.availability.map((status, index) => {
                      const week = data.weeks[index];
                      const isSelected =
                        isStationMatch && selectedCombination?.weeks.includes(week);
                      const isBookedName =
                        status !== '\u2713' &&
                        status !== '\u2717' &&
                        typeof status === 'string' &&
                        status.trim() !== '';
                      const isAvailable = status === '\u2713';
                      const isTempSelected = isCellSelected(row.stationId, week);

                      const baseClasses =
                        'p-2 border border-border font-mono text-sm transition-colors duration-200';
                      let colorClasses = '';

                      if (isTempSelected) {
                        colorClasses = 'bg-grid-selected border-grid-selected-border';
                      } else if (isSelected) {
                        colorClasses = 'bg-primary text-primary-foreground font-bold';
                      } else if (isAvailable) {
                        colorClasses =
                          'bg-grid-available text-grid-available-fg hover:bg-success-muted';
                      } else if (isBookedName) {
                        colorClasses =
                          'bg-grid-booked text-grid-booked-fg hover:bg-destructive-muted';
                      } else {
                        colorClasses = 'bg-grid-unavailable text-muted-foreground';
                      }

                      const clickable =
                        isBookedName || (isAvailable && !locked) ? ' cursor-pointer' : '';
                      const decoration = isBookedName ? ' underline decoration-dotted' : '';

                      return (
                        <td
                          key={index}
                          className={`${baseClasses} ${colorClasses}${clickable}${decoration}`}
                          onMouseDown={() =>
                            handleMouseDown(row.stationId, week, isAvailable, isBookedName)
                          }
                          onMouseEnter={() =>
                            handleMouseEnter(row.stationId, week, isAvailable, isBookedName)
                          }
                          title={
                            isBookedName
                              ? `${status} (Click to view details)`
                              : isAvailable
                                ? 'Available'
                                : status
                          }
                          style={{
                            maxWidth: '100px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {status}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50">
          <div
            ref={clearConfirmRef}
            role="dialog"
            aria-modal="true"
            className="bg-card rounded-xl shadow-xl p-6 max-w-md mx-4 border border-border"
          >
            <h3 className="text-lg font-semibold text-foreground">Clear All Bookings</h3>
            <p className="mt-2 text-muted-foreground">
              This will remove ALL bookings for this cycle. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-foreground hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-primary-foreground hover:bg-destructive/90"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
