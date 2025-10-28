import React, { useState, useCallback, useRef } from 'react';
import { findCombinations, fetchGrid, bookSlot, unbookSlot, getContactById, searchContactByName, exportExcel } from '../api';
import ContactSearch from './ContactSearch';

// Formats "W# - DD-Mon" using weekDates[] or termStartDate.
// Falls back to "W#" if no date info provided.
const formatWeekLabel = (data, idx) => {
  const weekNumber = data.weeks[idx];
  let date;

  if (Array.isArray(data.weekDates) && data.weekDates[idx]) {
    date = new Date(data.weekDates[idx]);
  } else if (data.termStartDate) {
    const start = new Date(data.termStartDate);
    // weekNumber is 1-based; add (week-1)*7 days
    start.setDate(start.getDate() + 7 * (weekNumber - 1));
    date = start;
  }

  if (date && !isNaN(date)) {
    // Example: 20-Oct
    const label = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `W${weekNumber} - ${label}`;
  }
  return `W${weekNumber}`;
};

// Helper function to format week with date for dropdowns
const formatWeekOption = (weekNum, gridData) => {
  if (!gridData || !gridData.weekDates || !gridData.weekDates[weekNum - 1]) {
    return `${weekNum}`;
  }
  const date = new Date(gridData.weekDates[weekNum - 1]);
  if (!isNaN(date)) {
    const label = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `${weekNum} - ${label}`;
  }
  return `${weekNum}`;
};

const SearchCriteriaForm = ({ criteria, onInputChange, onSearch, isLoading, gridData }) => (
    <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="space-y-4">
        <div>
            <label htmlFor="shift" className="block text-sm font-medium text-gray-700">Shift</label>
            <select id="shift" name="shift" value={criteria.shift} onChange={onInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>
        </div>
        <div>
            <label htmlFor="startWeek" className="block text-sm font-medium text-gray-700">Start Week</label>
            <select id="startWeek" name="startWeek" value={criteria.startWeek} onChange={onInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(week => (
                    <option key={`start-${week}`} value={week}>
                        {formatWeekOption(week, gridData)}
                    </option>
                ))}
            </select>
        </div>
        <div>
            <label htmlFor="endWeek" className="block text-sm font-medium text-gray-700">End Week</label>
            <select id="endWeek" name="endWeek" value={criteria.endWeek} onChange={onInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(week => (
                    <option key={`end-${week}`} value={week} disabled={week < criteria.startWeek}>
                        {formatWeekOption(week, gridData)} {week < criteria.startWeek ? '(Invalid)' : ''}
                    </option>
                ))}
            </select>
        </div>
        <div>
            <label htmlFor="weeksNeeded" className="block text-sm font-medium text-gray-700">Consecutive Weeks Needed</label>
            <input type="number" name="weeksNeeded" id="weeksNeeded" value={criteria.weeksNeeded} onChange={onInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" min="1" />
        </div>
        <div>
            <label htmlFor="level" className="block text-sm font-medium text-gray-700">Priority Level</label>
            <select id="level" name="level" value={criteria.level} onChange={onInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value={1}>Level 1 (LAB A, B, C, E priority)</option>
                <option value={2}>Level 2 (LAB B9, D priority)</option>
            </select>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Station Type</label>
            <div className="space-y-2">
                <label className="flex items-center">
                    <input type="radio" name="stationType" value="all" checked={criteria.stationType === 'all'} onChange={onInputChange} className="mr-2" />
                    <span className="text-sm text-gray-700">All Stations</span>
                </label>
                <label className="flex items-center">
                    <input type="radio" name="stationType" value="LH" checked={criteria.stationType === 'LH'} onChange={onInputChange} className="mr-2" />
                    <span className="text-sm text-gray-700">LH (Left Hand) Only</span>
                </label>
                <label className="flex items-center">
                    <input type="radio" name="stationType" value="RH" checked={criteria.stationType === 'RH'} onChange={onInputChange} className="mr-2" />
                    <span className="text-sm text-gray-700">RH (Right Hand) Only</span>
                </label>
            </div>
        </div>
        <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
            {isLoading ? 'Searching...' : 'Find Lab Availability'}
        </button>
    </form>
);

const BookingSection = ({ 
    traineeName, 
    onTraineeNameChange, 
    selectedContact, 
    onContactSelect, 
    onBook, 
    isBooking, 
    selectedCombination, 
    error, 
    successMessage 
}) => {
    const handleContactSelect = (contact) => {
        onContactSelect(contact);
        // Auto-fill trainee name when contact is selected
        if (contact) {
            onTraineeNameChange({ target: { value: contact.fullName } });
        }
    };

    return (
    <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Book Lab Slot</h2>
        <div className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
            {successMessage && <p className="text-sm text-green-600 bg-green-100 p-3 rounded-md">{successMessage}</p>}
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student Search</label>
                    <ContactSearch
                        onContactSelect={handleContactSelect}
                        selectedContact={selectedContact}
                        placeholder="Search for student by name..."
                    />
                </div>

            <div>
                <label htmlFor="traineeName" className="block text-sm font-medium text-gray-700">Trainee Name</label>
                    <input 
                        type="text" 
                        id="traineeName" 
                        value={traineeName} 
                        onChange={onTraineeNameChange} 
                        placeholder="Enter trainee name" 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" 
                    />
                </div>

                {selectedContact && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="font-medium text-blue-900">
                                    HubSpot Contact: {selectedContact.fullName}
                                </div>
                                <div className="text-sm text-blue-700">
                                    Payment Status: <span className="font-semibold">{selectedContact.paymentStatus || 'Unknown'}</span>
                                </div>
                                <div className="text-sm text-blue-700">
                                    Lifecycle Stage: {selectedContact.lifeCycleStage}
                                </div>
                            </div>
                        </div>
            </div>
                )}

                <button 
                    onClick={onBook} 
                    disabled={!selectedCombination || !traineeName || isBooking} 
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-200 ${selectedCombination && traineeName && !isBooking ? 'bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-offset-2 focus:ring-green-500' : 'bg-gray-400 cursor-not-allowed'}`}
                >
                {isBooking ? 'Booking...' : 'Book Selected Slot'}
            </button>
                
            {selectedCombination && (
                <div className="pt-2">
            <p className="text-sm text-slate-600">
                Selected:{' '}
                <span className="font-semibold text-slate-800">
                  {selectedCombination.lab} - Station {selectedCombination.station}
                </span>{' '}
                for weeks{' '}
                {selectedCombination.weeks
                  .map((_, i) =>
                    formatWeekLabel(
                      {
                        weeks: selectedCombination.weeks,
                        weekDates: selectedCombination.weekDates,
                        termStartDate: selectedCombination.termStartDate,
                      },
                      i
                    )
                  )
                  .join(', ')}
                .
            </p>
                </div>
            )}
        </div>
    </div>
);
};

const SearchResults = ({ results, selected, onSelect, isLoading, isCollapsed, onToggleCollapse }) => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 cursor-pointer" onClick={onToggleCollapse}>
            <h2 className="text-xl font-semibold text-slate-800">Ranked Lab Availabilities ({results.length})</h2>
            <button className="text-gray-500 hover:text-gray-700">
                {isCollapsed ? '▼' : '▲'}
            </button>
        </div>
        {!isCollapsed && (
        <div className="max-h-96 overflow-y-auto">
            {results.length > 0 ? (
                <div className="p-2 space-y-2">
                    {results.map((combo) => (
                        <button key={combo.id} onClick={() => onSelect(combo)} className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${selected?.id === combo.id ? 'bg-indigo-50 ring-2 ring-indigo-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                            <p className="font-semibold text-slate-800">{combo.lab} - Station {combo.station}</p>
                            <p className="text-sm text-slate-600">
                              Weeks:{' '}
                              {combo.weeks
                                .map((_, i) =>
                                  formatWeekLabel(
                                    { weeks: combo.weeks, weekDates: combo.weekDates, termStartDate: combo.termStartDate },
                                    i
                                  )
                                )
                                .join(', ')}
                            </p>
                        </button>
                    ))}
                </div>
            ) : (
                <p className="p-4 text-slate-500">{isLoading ? 'Loading results...' : 'No lab availability results found. Try adjusting your search criteria.'}</p>
            )}
        </div>
        )}
    </div>
);

const AvailabilityGrid = ({ data, selectedCombination, onUnbook, onBookCell, onShowStudentInfo, onExport, availableLabs, onLabChange }) => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedCells, setSelectedCells] = useState([]);
    const [selectionStart, setSelectionStart] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleMouseDown = (station, week, isAvailable, isBooked) => {
        if (isBooked) {
            // If clicking on a booked cell, show student info
            onShowStudentInfo({ lab: data.lab, station, shift: data.shift, week });
            return;
        }
        
        if (isAvailable) {
            setIsSelecting(true);
            setSelectionStart({ station, week });
            setSelectedCells([{ station, week }]);
        }
    };

    const handleMouseEnter = (station, week, isAvailable) => {
        if (isSelecting && isAvailable && selectionStart) {
            // Only allow selection in the same row
            if (station === selectionStart.station) {
                const startWeek = Math.min(selectionStart.week, week);
                const endWeek = Math.max(selectionStart.week, week);
                const newSelection = [];
                
                for (let w = startWeek; w <= endWeek; w++) {
                    newSelection.push({ station, week: w });
                }
                
                setSelectedCells(newSelection);
            }
        }
    };

    const handleMouseUp = () => {
        if (isSelecting && selectedCells.length > 0) {
            // Trigger booking for all selected cells
            onBookCell({
                lab: data.lab,
                station: selectedCells[0].station,
                shift: data.shift,
                weeks: selectedCells.map(cell => cell.week)
            });
        }
        setIsSelecting(false);
        setSelectedCells([]);
        setSelectionStart(null);
    };

    const isCellSelected = (station, week) => {
        return selectedCells.some(cell => cell.station === station && cell.week === week);
    };

    // Filter grid based on search query
    const filteredGrid = searchQuery.trim() 
        ? data.grid.filter(row => {
            return row.availability.some(status => {
                if (typeof status === 'string' && status !== '✓' && status !== '✗') {
                    return status.toLowerCase().includes(searchQuery.toLowerCase());
                }
                return false;
            });
        })
        : data.grid;

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-200" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="p-4 border-b border-gray-200 space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800">Availability Grid: {data.lab} ({data.shift})</h2>
                    <button
                        onClick={onExport}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                        📥 Export Excel
                    </button>
                </div>
                <div className="flex gap-3">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search for student in grid..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <select
                        value={data.lab}
                        onChange={(e) => onLabChange(e.target.value, data.shift)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {availableLabs.map(lab => (
                            <option key={lab} value={lab}>{lab}</option>
                        ))}
                    </select>
                    <select
                        value={data.shift}
                        onChange={(e) => onLabChange(data.lab, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                    </select>
                </div>
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
                        <th className="p-2 text-left text-sm font-semibold text-gray-600" style={{ width: '100px' }}>Station</th>
                        {data.weeks.map((_, i) => (
                            <th key={data.weeks[i]} className="p-2 text-sm font-semibold text-gray-600" style={{ width: '120px' }}>
                                {formatWeekLabel(data, i)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                        {filteredGrid.map(row => {
                            const stationId = row.stationId || row.station;
                            const rowStationBase = String(row.station).split('-')[0];
                            const selectedStationBase = selectedCombination?.station ? String(selectedCombination.station).split('-')[0] : null;
                            const isStationMatch = selectedStationBase && rowStationBase === selectedStationBase;
                            
                        return (
                            <tr key={row.station} className="odd:bg-white even:bg-gray-50">
                                    <td className={`p-2 border border-gray-200 font-bold ${isStationMatch ? 'text-indigo-600' : 'text-slate-700'}`}>{row.station}</td>
                                {row.availability.map((status, index) => {
                                    const week = data.weeks[index];
                                        const isSelected = isStationMatch && selectedCombination?.weeks.includes(week);
                                    const isBookedName = status !== '✓' && status !== '✗' && typeof status === 'string' && status.trim() !== '';
                                    // If backend stored an SID tag, display only the name part
                                    const displayText = (typeof status === 'string' && status.includes('[SID:'))
                                        ? status.split('[SID:')[0].trim()
                                        : status;
                                    const isAvailable = status === '✓';
                                        const isTempSelected = isCellSelected(stationId, week);
                                        
                                    const baseClasses = 'p-2 border border-gray-200 font-mono text-sm transition-colors duration-200';
                                        let colorClasses = '';
                                        
                                        if (isTempSelected) {
                                            colorClasses = 'bg-yellow-200 border-yellow-400';
                                        } else if (isSelected) {
                                            colorClasses = 'bg-indigo-500 text-white font-bold';
                                        } else if (isAvailable) {
                                            colorClasses = 'bg-green-100 text-green-800 hover:bg-green-200';
                                        } else if (isBookedName) {
                                            colorClasses = 'bg-red-100 text-red-800 hover:bg-red-200';
                                        } else {
                                            colorClasses = 'bg-gray-100 text-gray-500';
                                        }
                                        
                                    const clickable = (isBookedName || isAvailable) ? ' cursor-pointer' : '';
                                    const decoration = isBookedName ? ' underline decoration-dotted' : '';
                                        
                                    const hoverText = isBookedName 
                                            ? `${status} (Click to view details)` 
                                        : isAvailable 
                                            ? 'Available - Click and drag to select multiple' 
                                        : status;
                                        
                                    return (
                                        <td 
                                            key={index} 
                                            className={`${baseClasses} ${colorClasses}${clickable}${decoration}`} 
                                                onMouseDown={() => handleMouseDown(stationId, week, isAvailable, isBookedName)}
                                                onMouseEnter={() => handleMouseEnter(stationId, week, isAvailable)}
                                            title={hoverText}
                                            style={{ 
                                                maxWidth: '120px', 
                                                overflow: 'hidden', 
                                                textOverflow: 'ellipsis', 
                                                whiteSpace: 'nowrap' 
                                            }}
                                        >
                                            {displayText}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
);
};


export default function AvailabilityFinder() {
    const [searchCriteria, setSearchCriteria] = useState({ shift: 'AM', startWeek: 1, endWeek: 12, weeksNeeded: 2, level: 1, stationType: 'all' });
    const [results, setResults] = useState([]);
    const [selectedCombination, setSelectedCombination] = useState(null);
    const [gridData, setGridData] = useState(null);
    const [traineeName, setTraineeName] = useState('');
    const [selectedContact, setSelectedContact] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBooking, setIsBooking] = useState(false);
    const [error, setError] = useState(null);
    const [bookingSuccess, setBookingSuccess] = useState('');
    const [cellBookingDialog, setCellBookingDialog] = useState(null);
    const [cellBookingName, setCellBookingName] = useState('');
    const [studentInfoDialog, setStudentInfoDialog] = useState(null);
    const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
    const [availableLabs] = useState(['Lab A', 'Lab B', 'Lab C', 'Lab D', 'Lab E']); // All labs

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        const newValue = type === 'number' ? parseInt(value, 10) : value;
        
        setSearchCriteria(prev => {
            const updated = { ...prev, [name]: newValue };
            
            if (name === 'startWeek') {
                const startWeek = newValue;
                const endWeek = prev.endWeek;
                
                if (endWeek < startWeek) {
                    updated.endWeek = startWeek;
                }
            }
            
            return updated;
        });
    };

    const handleContactSelect = (contact) => {
        setSelectedContact(contact);
    };

    const handleExport = async () => {
        try {
            await exportExcel();
        } catch (err) {
            setError('Failed to export Excel file.');
        }
    };

    const handleLabChange = async (lab, shift) => {
        try {
            const data = await fetchGrid(lab, shift);
            setGridData(data);
        } catch (err) {
            setError('Failed to load grid for selected lab.');
        }
    };

    const handleSearch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setBookingSuccess('');
        setResults([]);
        setSelectedCombination(null);
        setGridData(null);
        try {
            const combinations = await findCombinations(searchCriteria);
            setResults(combinations);
        } catch (err) {
            setError('Failed to search for availability. Please try again.');
        }
        setIsLoading(false);
    }, [searchCriteria]);

    const handleSelectCombination = useCallback(async (combination) => {
        setSelectedCombination(combination);
        setGridData(null);
        try {
            const newGridData = await fetchGrid(combination.lab, combination.shift);
            setGridData(newGridData);
        } catch (err) {
            setError('Failed to load availability grid.');
        }
    }, []);

    const handleShowStudentInfo = useCallback(async ({ lab, station, shift, week }) => {
        try {
            // Find the student name from the grid
            const row = gridData.grid.find(r => (r.stationId || r.station) === station);
            if (!row) return;
            
            const weekIndex = gridData.weeks.indexOf(week);
            const rawValue = row.availability[weekIndex];
            const sidMatch = typeof rawValue === 'string' ? rawValue.match(/\[SID:(\d+)\]/) : null;
            // Some prod entries are saved as "Name-123456"; extract trailing numeric token as student ID
            const inlineIdMatch = typeof rawValue === 'string' ? rawValue.match(/(?:-|\s)(\d{4,})\s*$/) : null;
            const studentName = typeof rawValue === 'string' && rawValue.includes('[SID:')
                ? rawValue.split('[SID:')[0].trim()
                : rawValue;
            
            if (!studentName || studentName === '✓' || studentName === '✗') return;
            
            setStudentInfoDialog({
                lab,
                station,
                shift,
                week,
                studentName,
                loading: true,
                hubspotContact: null
            });
            
            // Try to fetch HubSpot contact info; prefer exact contactId encoded in cell if present
            try {
                if (sidMatch && sidMatch[1]) {
                    const byId = await getContactById(sidMatch[1]);
                    if (byId) {
                        setStudentInfoDialog(prev => ({ ...prev, loading: false, hubspotContact: byId }));
                        return;
                    }
                }

                // Try inline numeric ID from formats like "Name-2301416"
                if (inlineIdMatch && inlineIdMatch[1]) {
                    // ID after '-' is Student ID, not the HubSpot object id → use search by student_id
                    const byStudentId = await searchContactByName(inlineIdMatch[1]);
                    if (byStudentId) {
                        setStudentInfoDialog(prev => ({ ...prev, loading: false, hubspotContact: byStudentId }));
                        return;
                    }
                }

                console.log('🔍 Searching HubSpot for:', studentName);
                
                // Search with the full name first
                let contact = await searchContactByName(studentName);
                
                // If not found, try searching with just first/last name parts
                if (!contact && studentName.includes(' ')) {
                    const nameParts = studentName.trim().split(/\s+/);
                    console.log('🔍 Trying name parts:', nameParts);
                    
                    // Try first name
                    if (nameParts[0]) {
                        console.log('🔍 Searching by first name:', nameParts[0]);
                        contact = await searchContactByName(nameParts[0]);
                    }
                    // Try last name if first name didn't work
                    if (!contact && nameParts[nameParts.length - 1]) {
                        console.log('🔍 Searching by last name:', nameParts[nameParts.length - 1]);
                        contact = await searchContactByName(nameParts[nameParts.length - 1]);
                    }
                }
                
                if (contact) {
                    console.log('✅ Found HubSpot contact:', contact.fullName, contact.id);
                } else {
                    console.warn('❌ No HubSpot contact found for:', studentName);
                }
                
                setStudentInfoDialog(prev => ({
                    ...prev,
                    loading: false,
                    hubspotContact: contact
                }));
            } catch (error) {
                console.warn('Failed to fetch HubSpot contact:', error);
                setStudentInfoDialog(prev => ({
                    ...prev,
                    loading: false
                }));
            }
            
        } catch (error) {
            console.error('Failed to fetch student info:', error);
        }
    }, [gridData]);

    const handleUnbook = useCallback(async ({ lab, station, shift, week }) => {
        try {
            await unbookSlot({ lab, station, shift, weeks: [week] });
            if (gridData) {
                const refreshed = await fetchGrid(lab, shift);
                setGridData(refreshed);
            }
            setStudentInfoDialog(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to unbook slot.');
        }
    }, [gridData]);

    const handleBookCell = useCallback(({ lab, station, shift, weeks }) => {
        setCellBookingDialog({ lab, station, shift, weeks });
        setCellBookingName('');
    }, []);

    const handleCellBookingSubmit = useCallback(async () => {
        if (!cellBookingDialog || !cellBookingName.trim()) {
            setError('Please enter a trainee name.');
            return;
        }

        try {
            setIsBooking(true);
            setError(null);
            await bookSlot({
                lab: cellBookingDialog.lab,
                station: cellBookingDialog.station,
                shift: cellBookingDialog.shift,
                weeks: cellBookingDialog.weeks,
                traineeName: cellBookingName.trim(),
                contactId: selectedContact?.id,
                paymentStatus: selectedContact?.paymentStatus
            });
            
            const weeksText = cellBookingDialog.weeks.length > 1 
                ? `weeks ${cellBookingDialog.weeks.join(', ')}`
                : `week ${cellBookingDialog.weeks[0]}`;
            
            setBookingSuccess(`Successfully booked ${cellBookingDialog.lab} - Station ${cellBookingDialog.station} for ${weeksText}!`);
            setCellBookingDialog(null);
            setCellBookingName('');
            
            if (gridData) {
                const refreshed = await fetchGrid(cellBookingDialog.lab, cellBookingDialog.shift);
                setGridData(refreshed);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to book slot.');
        } finally {
            setIsBooking(false);
        }
    }, [cellBookingDialog, cellBookingName, gridData, selectedContact]);

    const handleBookSlot = async () => {
        if (!selectedCombination || !traineeName) {
            setError("Please select a slot and enter a trainee name to book.");
            return;
        }
        setIsBooking(true);
        setError(null);
        setBookingSuccess('');
        try {
            const bookingData = { 
                ...selectedCombination, 
                traineeName,
                contactId: selectedContact?.id,
                paymentStatus: selectedContact?.paymentStatus
            };
            
            await bookSlot(bookingData);
            
            const paymentStatusText = selectedContact?.paymentStatus ? ` (Payment Status: ${selectedContact.paymentStatus})` : '';
            setBookingSuccess(`Successfully booked ${selectedCombination.lab} - Station ${selectedCombination.station} for ${traineeName}${paymentStatusText}.`);
            
            setSelectedCombination(null);
            setTraineeName('');
            setSelectedContact(null);
            setGridData(null);
            await handleSearch();
        } catch (err) {
            setError(err.response?.data?.error || 'An unexpected error occurred during booking.');
        }
        setIsBooking(false);
    };

    return (
        <div className="bg-gray-50 min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Lab Availability Manager</h1>
                    <p className="text-slate-600 mt-1">Find and book available lab stations for trainees.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                            <h2 className="text-xl font-semibold text-slate-800 mb-4">Search Criteria</h2>
                            <SearchCriteriaForm 
                                criteria={searchCriteria} 
                                onInputChange={handleInputChange} 
                                onSearch={handleSearch} 
                                isLoading={isLoading}
                                gridData={gridData}
                            />
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                            <BookingSection
                                traineeName={traineeName}
                                onTraineeNameChange={e => setTraineeName(e.target.value)}
                                selectedContact={selectedContact}
                                onContactSelect={handleContactSelect}
                                onBook={handleBookSlot}
                                isBooking={isBooking}
                                selectedCombination={selectedCombination}
                                error={error}
                                successMessage={bookingSuccess}
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        <SearchResults 
                            results={results} 
                            selected={selectedCombination} 
                            onSelect={handleSelectCombination} 
                            isLoading={isLoading}
                            isCollapsed={isResultsCollapsed}
                            onToggleCollapse={() => setIsResultsCollapsed(!isResultsCollapsed)}
                        />
                        {gridData && (
                            <AvailabilityGrid 
                                data={gridData} 
                                selectedCombination={selectedCombination} 
                                onUnbook={handleUnbook} 
                                onBookCell={handleBookCell}
                                onShowStudentInfo={handleShowStudentInfo}
                                onExport={handleExport}
                                availableLabs={availableLabs}
                                onLabChange={handleLabChange}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Cell Booking Dialog */}
            {cellBookingDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Book Slot{cellBookingDialog.weeks.length > 1 ? 's' : ''}</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div>
                                    <span className="font-semibold text-gray-700">Lab:</span>
                                    <p className="text-slate-600 ml-4">{cellBookingDialog.lab}</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-700">Station:</span>
                                    <p className="text-slate-600 ml-4">{cellBookingDialog.station}</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-700">Shift:</span>
                                    <p className="text-slate-600 ml-4">{cellBookingDialog.shift}</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-700">Week{cellBookingDialog.weeks.length > 1 ? 's' : ''}:</span>
                                    <p className="text-slate-600 ml-4">{cellBookingDialog.weeks.join(', ')}</p>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="cellBookingName" className="block text-sm font-medium text-gray-700 mb-2">
                                    Trainee Name
                                </label>
                                <input
                                    type="text"
                                    id="cellBookingName"
                                    value={cellBookingName}
                                    onChange={(e) => setCellBookingName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter trainee name"
                                    autoFocus
                                />
                            </div>
                            {selectedContact && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <div className="text-sm">
                                        <div className="font-medium text-blue-900">{selectedContact.fullName}</div>
                                        <div className="text-blue-700">Payment: {selectedContact.paymentStatus}</div>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCellBookingSubmit}
                                    disabled={isBooking || !cellBookingName.trim()}
                                    className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
                                        isBooking || !cellBookingName.trim()
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-green-600 hover:bg-green-700'
                                    }`}
                                >
                                    {isBooking ? 'Booking...' : 'Book Slot'}
                                </button>
                                <button
                                    onClick={() => {
                                        setCellBookingDialog(null);
                                        setCellBookingName('');
                                    }}
                                    disabled={isBooking}
                                    className="flex-1 py-2 px-4 rounded-md bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Student Info Dialog */}
            {studentInfoDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-slate-800">Student Information</h3>
                            <button
                                onClick={() => setStudentInfoDialog(null)}
                                className="text-gray-400 hover:text-gray-600 text-xl"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {studentInfoDialog.loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                <span className="ml-3 text-gray-600">Loading HubSpot data...</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Booking Details */}
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                    <h4 className="font-semibold text-gray-900 mb-2">Booking Details</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="font-medium text-gray-700">Student:</span>
                                            <p className="text-slate-600">{studentInfoDialog.studentName}</p>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Lab:</span>
                                            <p className="text-slate-600">{studentInfoDialog.lab}</p>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Station:</span>
                                            <p className="text-slate-600">{studentInfoDialog.station}</p>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Shift:</span>
                                            <p className="text-slate-600">{studentInfoDialog.shift}</p>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-700">Week:</span>
                                            <p className="text-slate-600">{studentInfoDialog.week}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* HubSpot Contact Info */}
                                {studentInfoDialog.hubspotContact ? (
                                    <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                                        <h4 className="font-semibold text-blue-900 mb-2">HubSpot Contact</h4>
                                        <div className="space-y-2 text-sm">
                                            <div>
                                                <span className="font-medium text-blue-800">Name:</span>
                                                <p className="text-blue-700">{studentInfoDialog.hubspotContact.fullName}</p>
                                            </div>
                                            {studentInfoDialog.hubspotContact.email && (
                                                <div>
                                                    <span className="font-medium text-blue-800">Email:</span>
                                                    <p className="text-blue-700">{studentInfoDialog.hubspotContact.email}</p>
                                                </div>
                                            )}
                                            {studentInfoDialog.hubspotContact.phone && (
                                                <div>
                                                    <span className="font-medium text-blue-800">Phone:</span>
                                                    <p className="text-blue-700">{studentInfoDialog.hubspotContact.phone}</p>
                                                </div>
                                            )}
                                            {studentInfoDialog.hubspotContact.studentId && (
                                                <div>
                                                    <span className="font-medium text-blue-800">Student ID:</span>
                                                    <p className="text-blue-700">{studentInfoDialog.hubspotContact.studentId}</p>
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium text-blue-800">Payment Status:</span>
                                                <p className={`inline-block ml-2 px-2 py-1 rounded text-xs font-semibold ${
                                                    studentInfoDialog.hubspotContact.paymentStatus?.toLowerCase().includes('paid') 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : studentInfoDialog.hubspotContact.paymentStatus?.toLowerCase().includes('pending')
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {studentInfoDialog.hubspotContact.paymentStatus || 'Unknown'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-blue-800">Lifecycle Stage:</span>
                                                <p className="text-blue-700">{studentInfoDialog.hubspotContact.lifeCycleStage || 'Unknown'}</p>
                                            </div>
                                        </div>

                                        {/* Deals Information */}
                                        {studentInfoDialog.hubspotContact.deals && studentInfoDialog.hubspotContact.deals.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-blue-200">
                                                <h5 className="font-semibold text-blue-900 mb-2">Associated Deals ({studentInfoDialog.hubspotContact.deals.length})</h5>
                                                <div className="space-y-2">
                                                    {studentInfoDialog.hubspotContact.deals.map((deal, idx) => (
                                                        <div key={deal.id || idx} className="bg-white p-3 rounded border border-blue-200">
                                                            <div className="font-medium text-gray-900">{deal.properties?.dealname || 'Unnamed Deal'}</div>
                                                            <div className="text-xs text-gray-600 mt-1 space-y-1">
                                                                {deal.stageName && (
                                                                    <div>
                                                                        <span className="font-medium">Stage:</span> 
                                                                        <span className={`ml-1 px-2 py-0.5 rounded ${
                                                                            deal.stageName.toLowerCase().includes('paid') 
                                                                                ? 'bg-green-100 text-green-800' 
                                                                                : 'bg-gray-100 text-gray-700'
                                                                        }`}>
                                                                            {deal.stageName}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {deal.properties?.amount && (
                                                                    <div><span className="font-medium">Amount:</span> ${deal.properties.amount}</div>
                                                                )}
                                                                {deal.properties?.closedate && (
                                                                    <div>
                                                                        <span className="font-medium">Close Date:</span> {new Date(deal.properties.closedate).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-yellow-50 p-4 rounded-lg">
                                        <p className="text-sm text-yellow-800">
                                            ⚠️ No HubSpot contact found for "{studentInfoDialog.studentName}"
                                        </p>
                                    </div>
                                )}
                                
                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => handleUnbook({
                                            lab: studentInfoDialog.lab,
                                            station: studentInfoDialog.station,
                                            shift: studentInfoDialog.shift,
                                            week: studentInfoDialog.week
                                        })}
                                        className="flex-1 py-2 px-4 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                                    >
                                        Remove Student
                                    </button>
                                    <button
                                        onClick={() => setStudentInfoDialog(null)}
                                        className="flex-1 py-2 px-4 rounded-md bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
