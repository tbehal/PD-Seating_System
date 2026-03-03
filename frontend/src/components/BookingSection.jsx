import React from 'react';
import ContactSearch from './ContactSearch';

export default function BookingSection({
  traineeName,
  onTraineeNameChange,
  selectedContact,
  onContactSelect,
  onBook,
  isBooking,
  selectedCombination,
  locked,
}) {
  const handleContactSelect = (contact) => {
    onContactSelect(contact);
    if (contact) {
      onTraineeNameChange({ target: { value: contact.fullName } });
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground mb-4">Book Lab Slot</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary-foreground mb-2">
            Student Search
          </label>
          <ContactSearch
            onContactSelect={handleContactSelect}
            selectedContact={selectedContact}
            placeholder="Search for student by name..."
          />
        </div>

        <div>
          <label
            htmlFor="traineeName"
            className="block text-sm font-medium text-secondary-foreground"
          >
            Trainee Name
          </label>
          <input
            type="text"
            id="traineeName"
            value={traineeName}
            onChange={onTraineeNameChange}
            placeholder="Enter trainee name"
            className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
            disabled={locked}
          />
        </div>

        {selectedContact && (
          <div className="p-3 bg-info-muted border border-info/30 rounded-md">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-foreground">
                  HubSpot Contact: {selectedContact.fullName}
                </div>
                <div className="text-sm text-muted-foreground">
                  Payment Status:{' '}
                  <span className="font-semibold">
                    {selectedContact.paymentStatus || 'Unknown'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Lifecycle Stage: {selectedContact.lifeCycleStage}
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onBook}
          disabled={!selectedCombination || !traineeName || isBooking || locked}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground transition-colors duration-200 ${
            selectedCombination && traineeName && !isBooking && !locked
              ? 'bg-primary hover:bg-primary/90 focus:ring-2 focus:ring-offset-2 focus:ring-ring'
              : 'bg-muted cursor-not-allowed'
          }`}
        >
          {locked ? 'Cycle Locked' : isBooking ? 'Booking...' : 'Book Selected Slot'}
        </button>

        {selectedCombination && (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">
              Selected:{' '}
              <span className="font-semibold text-foreground">
                {selectedCombination.lab} - Station {selectedCombination.station}
              </span>{' '}
              for weeks {selectedCombination.weeks.join(', ')}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
