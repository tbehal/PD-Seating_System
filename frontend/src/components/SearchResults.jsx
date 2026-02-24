import React from 'react';

export default function SearchResults({ results, selected, onSelect, isLoading, isCollapsed, onToggleCollapse }) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 cursor-pointer" onClick={onToggleCollapse}>
        <h2 className="text-xl font-semibold text-slate-800">Ranked Lab Availabilities ({results.length})</h2>
        <button className="text-gray-500 hover:text-gray-700">
          {isCollapsed ? '\u25BC' : '\u25B2'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <div className="p-2 space-y-2">
              {results.map((combo) => (
                <button
                  key={combo.id}
                  onClick={() => onSelect(combo)}
                  className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${
                    selected?.id === combo.id
                      ? 'bg-brand-50 ring-2 ring-brand-500'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <p className="font-semibold text-slate-800">{combo.lab} - Station {combo.station}</p>
                  <p className="text-sm text-slate-600">
                    Weeks: {combo.weeks.join(', ')}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="p-4 text-slate-500">
              {isLoading ? 'Loading results...' : 'No lab availability results found. Try adjusting your search criteria.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
