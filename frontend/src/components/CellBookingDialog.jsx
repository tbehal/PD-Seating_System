import React from 'react';
import ContactSearch from './ContactSearch';

export default function CellBookingDialog({
  dialog,
  cellBookingName,
  setCellBookingName,
  selectedContact,
  onContactSelect,
  onSubmit,
  onCancel,
  isBooking,
}) {
  if (!dialog) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4">
          Book Slot{dialog.weeks.length > 1 ? 's' : ''}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student Search</label>
            <ContactSearch
              onContactSelect={(contact) => {
                onContactSelect(contact);
                if (contact) {
                  setCellBookingName(contact.fullName);
                }
              }}
              selectedContact={selectedContact}
              placeholder="Search by name, email, or student ID..."
            />
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-gray-700">Station:</span>
              <p className="text-slate-600 ml-4">{dialog.stationLabel}</p>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Shift:</span>
              <p className="text-slate-600 ml-4">{dialog.shift}</p>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Week{dialog.weeks.length > 1 ? 's' : ''}:</span>
              <p className="text-slate-600 ml-4">{dialog.weeks.join(', ')}</p>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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
              onClick={onSubmit}
              disabled={isBooking || !cellBookingName.trim()}
              className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
                isBooking || !cellBookingName.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-brand-500 hover:bg-brand-600'
              }`}
            >
              {isBooking ? 'Booking...' : 'Book Slot'}
            </button>
            <button
              onClick={onCancel}
              disabled={isBooking}
              className="flex-1 py-2 px-4 rounded-md bg-gray-200 text-gray-800 font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
