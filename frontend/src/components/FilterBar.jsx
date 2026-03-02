import React from 'react';

export default function FilterBar({ filters, onChange }) {
  const handleChange = (e) => {
    onChange({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <label htmlFor="filter-shift" className="text-sm font-medium text-gray-700">
          Shift
        </label>
        <select
          id="filter-shift"
          name="shift"
          value={filters.shift}
          onChange={handleChange}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="filter-labType" className="text-sm font-medium text-gray-700">
          Lab Type
        </label>
        <select
          id="filter-labType"
          name="labType"
          value={filters.labType}
          onChange={handleChange}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="REGULAR">Regular Lab (A, B, C, E)</option>
          <option value="PRE_EXAM">Pre-Exam Lab (B9, D)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="filter-side" className="text-sm font-medium text-gray-700">
          Side
        </label>
        <select
          id="filter-side"
          name="side"
          value={filters.side}
          onChange={handleChange}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="ALL">All Stations</option>
          <option value="RH">RH (Right Hand)</option>
          <option value="LH">LH (Left Hand)</option>
        </select>
      </div>
    </div>
  );
}
