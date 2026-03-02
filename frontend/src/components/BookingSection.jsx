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
  error,
  successMessage,
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
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Book Lab Slot</h2>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
        {successMessage && (
          <p className="text-sm text-green-600 bg-green-100 p-3 rounded-md">{successMessage}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Student Search</label>
          <ContactSearch
            onContactSelect={handleContactSelect}
            selectedContact={selectedContact}
            placeholder="Search for student by name..."
          />
        </div>

        <div>
          <label htmlFor="traineeName" className="block text-sm font-medium text-gray-700">
            Trainee Name
          </label>
          <input
            type="text"
            id="traineeName"
            value={traineeName}
            onChange={onTraineeNameChange}
            placeholder="Enter trainee name"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
            disabled={locked}
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
                  Payment Status:{' '}
                  <span className="font-semibold">
                    {selectedContact.paymentStatus || 'Unknown'}
                  </span>
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
          disabled={!selectedCombination || !traineeName || isBooking || locked}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-200 ${
            selectedCombination && traineeName && !isBooking && !locked
              ? 'bg-brand-500 hover:bg-brand-600 focus:ring-2 focus:ring-offset-2 focus:ring-brand-500'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {locked ? 'Cycle Locked' : isBooking ? 'Booking...' : 'Book Selected Slot'}
        </button>

        {selectedCombination && (
          <div className="pt-2">
            <p className="text-sm text-slate-600">
              Selected:{' '}
              <span className="font-semibold text-slate-800">
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
