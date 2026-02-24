import React, { useState, useRef, useEffect } from 'react';

// Format a date string like "2026-01-06" to short format like "Jan 6"
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Format week header label with optional date range
function weekLabel(week, weekDates) {
  const wd = weekDates?.find(w => w.week === week);
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
  const popoverRef = useRef(null);

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
    const wd = data.weekDates?.find(w => w.week === week);
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
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center text-gray-400">
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
      weeks: selectedCells.map(cell => cell.week),
    };
    if (selectionMode === 'book') {
      onBookCell(payload);
    } else if (selectionMode === 'unbook') {
      onUnbookMany(payload);
    }
    clearSelection();
  };

  const isCellSelected = (stationId, week) => {
    return selectedCells.some(cell => cell.stationId === stationId && cell.week === week);
  };

  // Filter grid based on search query
  const filteredGrid = searchQuery.trim()
    ? data.grid.filter(row =>
        row.availability.some(status =>
          typeof status === 'string' && status !== '\u2713' && status !== '\u2717' && status.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : data.grid;

  // Group by lab name for visual grouping
  let lastLabName = null;

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">
            Availability Grid
            {locked && <span className="ml-2 text-sm text-amber-600 font-normal">(Read-only)</span>}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 transition-colors text-sm font-medium"
            >
              Export CSV
            </button>
            {!locked && (
              <button
                onClick={() => {
                  if (confirm('Clear ALL bookings for this cycle? This cannot be undone.')) {
                    onClearAll();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Drag selection toolbar */}
        {selectedCells.length > 0 && !locked && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md flex items-center justify-between gap-2">
            <div className="text-sm text-yellow-900">
              {selectionMode === 'book' ? 'Selected available weeks' : 'Selected booked weeks'}: {selectedCells.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmSelection}
                className={`px-3 py-1 rounded-md text-white text-sm font-medium ${
                  selectionMode === 'book' ? 'bg-brand-500 hover:bg-brand-600' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {selectionMode === 'book' ? 'Book Selected' : 'Clear Selected'}
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 rounded-md bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300"
              >
                Cancel Selection
              </button>
            </div>
          </div>
        )}

        {searchQuery && (
          <p className="text-sm text-gray-600">
            Found {filteredGrid.length} station(s) with "{searchQuery}"
          </p>
        )}
      </div>

      <div className="overflow-x-auto p-2">
        <table className="min-w-full border-collapse text-center" style={{ tableLayout: 'fixed', userSelect: 'none' }}>
          <thead>
            <tr>
              <th className="p-2 text-left text-sm font-semibold text-gray-600" style={{ width: '160px' }}>Station</th>
              {data.weeks.map((w) => {
                const { label, dateRange } = weekLabel(w, data.weekDates);
                return (
                  <th
                    key={w}
                    className={`p-2 text-sm font-semibold text-gray-600 relative ${!locked ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                    style={{ width: '100px' }}
                    onClick={() => handleWeekHeaderClick(w)}
                    title={!locked ? 'Click to set week dates' : undefined}
                  >
                    <div>{label}</div>
                    {dateRange && (
                      <div className="text-xs font-normal text-gray-400">{dateRange}</div>
                    )}
                    {editingWeek === w && (
                      <div
                        ref={popoverRef}
                        className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 w-56"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-left text-xs font-semibold text-gray-700 mb-2">Week {w} Dates</div>
                        <label htmlFor={`week-${w}-start`} className="block text-left text-xs text-gray-500 mb-1">Start Date</label>
                        <input
                          id={`week-${w}-start`}
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <label htmlFor={`week-${w}-end`} className="block text-left text-xs text-gray-500 mb-1">End Date</label>
                        <input
                          id={`week-${w}-end`}
                          type="date"
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveWeekDates}
                            className="flex-1 px-2 py-1 bg-brand-500 text-white rounded text-xs font-medium hover:bg-brand-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingWeek(null)}
                            className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
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

              const isStationMatch = selectedCombination && selectedCombination.stationId === row.stationId;

              return (
                <React.Fragment key={row.stationId}>
                  {showLabHeader && (
                    <tr>
                      <td colSpan={data.weeks.length + 1} className="p-2 bg-gray-100 text-left text-sm font-bold text-gray-700 border-t-2 border-gray-300">
                        {row.labName}
                      </td>
                    </tr>
                  )}
                  <tr className="odd:bg-white even:bg-gray-50">
                    <td className={`p-2 border border-gray-200 font-bold text-left ${isStationMatch ? 'text-brand-600' : 'text-slate-700'}`}>
                      {row.station}
                    </td>
                    {row.availability.map((status, index) => {
                      const week = data.weeks[index];
                      const isSelected = isStationMatch && selectedCombination?.weeks.includes(week);
                      const isBookedName = status !== '\u2713' && status !== '\u2717' && typeof status === 'string' && status.trim() !== '';
                      const isAvailable = status === '\u2713';
                      const isTempSelected = isCellSelected(row.stationId, week);

                      const baseClasses = 'p-2 border border-gray-200 font-mono text-sm transition-colors duration-200';
                      let colorClasses = '';

                      if (isTempSelected) {
                        colorClasses = 'bg-yellow-200 border-yellow-400';
                      } else if (isSelected) {
                        colorClasses = 'bg-brand-500 text-white font-bold';
                      } else if (isAvailable) {
                        colorClasses = 'bg-green-100 text-green-800 hover:bg-green-200';
                      } else if (isBookedName) {
                        colorClasses = 'bg-red-100 text-red-800 hover:bg-red-200';
                      } else {
                        colorClasses = 'bg-gray-100 text-gray-500';
                      }

                      const clickable = (isBookedName || (isAvailable && !locked)) ? ' cursor-pointer' : '';
                      const decoration = isBookedName ? ' underline decoration-dotted' : '';

                      return (
                        <td
                          key={index}
                          className={`${baseClasses} ${colorClasses}${clickable}${decoration}`}
                          onMouseDown={() => handleMouseDown(row.stationId, week, isAvailable, isBookedName)}
                          onMouseEnter={() => handleMouseEnter(row.stationId, week, isAvailable, isBookedName)}
                          title={isBookedName ? `${status} (Click to view details)` : isAvailable ? 'Available' : status}
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
    </div>
  );
}
