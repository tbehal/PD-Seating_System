import React from 'react';

export default function SearchResults({
  results,
  selected,
  onSelect,
  isLoading,
  isCollapsed,
  onToggleCollapse,
}) {
  return (
    <div className="bg-card rounded-xl shadow-md border border-border">
      <div
        className="flex justify-between items-center p-4 border-b border-border cursor-pointer"
        onClick={onToggleCollapse}
      >
        <h2 className="text-xl font-semibold text-foreground">
          Ranked Lab Availabilities ({results.length})
        </h2>
        <button className="text-muted-foreground hover:text-secondary-foreground">
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
                      ? 'bg-primary/10 ring-2 ring-ring'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  <p className="font-semibold text-foreground">
                    {combo.lab} - Station {combo.station}
                  </p>
                  <p className="text-sm text-muted-foreground">Weeks: {combo.weeks.join(', ')}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="p-4 text-muted-foreground">
              {isLoading
                ? 'Loading results...'
                : 'No lab availability results found. Try adjusting your search criteria.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
