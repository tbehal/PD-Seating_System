import React from 'react';

export default function SearchCriteriaForm({ criteria, onInputChange, onSearch, isLoading }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="startWeek" className="block text-sm font-medium text-gray-700">
          Start Week
        </label>
        <select
          id="startWeek"
          name="startWeek"
          value={criteria.startWeek}
          onChange={onInputChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => (
            <option key={`start-${week}`} value={week}>
              {week}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="endWeek" className="block text-sm font-medium text-gray-700">
          End Week
        </label>
        <select
          id="endWeek"
          name="endWeek"
          value={criteria.endWeek}
          onChange={onInputChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => (
            <option key={`end-${week}`} value={week} disabled={week < criteria.startWeek}>
              {week} {week < criteria.startWeek ? '(Invalid)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="weeksNeeded" className="block text-sm font-medium text-gray-700">
          Consecutive Weeks Needed
        </label>
        <input
          type="number"
          name="weeksNeeded"
          id="weeksNeeded"
          value={criteria.weeksNeeded}
          onChange={onInputChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
          min="1"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:bg-gray-400"
      >
        {isLoading ? 'Searching...' : 'Find Availability'}
      </button>
    </form>
  );
}
