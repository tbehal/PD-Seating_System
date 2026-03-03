import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema } from '../schemas/booking';
import ContactSearch from './ContactSearch';
import { useFocusTrap } from '../hooks/useFocusTrap';

export default function CellBookingDialog({ dialog, onSubmit, onCancel, isBooking }) {
  const [selectedContact, setSelectedContact] = useState(null);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, !!dialog, { onEscape: onCancel });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { traineeName: '', contactId: null },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (dialog) {
      reset({ traineeName: '', contactId: null });
      setSelectedContact(null);
    }
  }, [dialog, reset]);

  if (!dialog) return null;

  const traineeName = watch('traineeName');

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    if (contact) {
      setValue('traineeName', contact.fullName, { shouldValidate: true });
      setValue('contactId', contact.id);
    }
  };

  const onFormSubmit = (data) => {
    onSubmit({ traineeName: data.traineeName, contactId: data.contactId || selectedContact?.id });
  };

  return (
    <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6"
      >
        <h3 className="text-xl font-bold text-foreground mb-4">
          Book Slot{dialog.weeks.length > 1 ? 's' : ''}
        </h3>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-foreground mb-2">
              Student Search
            </label>
            <ContactSearch
              onContactSelect={handleContactSelect}
              selectedContact={selectedContact}
              placeholder="Search by name, email, or student ID..."
            />
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-secondary-foreground">Station:</span>
              <p className="text-muted-foreground ml-4">{dialog.stationLabel}</p>
            </div>
            <div>
              <span className="font-semibold text-secondary-foreground">Shift:</span>
              <p className="text-muted-foreground ml-4">{dialog.shift}</p>
            </div>
            <div>
              <span className="font-semibold text-secondary-foreground">
                Week{dialog.weeks.length > 1 ? 's' : ''}:
              </span>
              <p className="text-muted-foreground ml-4">{dialog.weeks.join(', ')}</p>
            </div>
          </div>
          <div>
            <label
              htmlFor="cellBookingName"
              className="block text-sm font-medium text-secondary-foreground mb-2"
            >
              Trainee Name
            </label>
            <input
              type="text"
              id="cellBookingName"
              {...register('traineeName')}
              className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              placeholder="Enter trainee name"
              autoFocus
            />
            {errors.traineeName && (
              <p className="mt-1 text-sm text-destructive">{errors.traineeName.message}</p>
            )}
          </div>
          {selectedContact && (
            <div className="p-3 bg-info-muted border border-info/30 rounded-md">
              <div className="text-sm">
                <div className="font-medium text-info">{selectedContact.fullName}</div>
                <div className="text-info">Payment: {selectedContact.paymentStatus}</div>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isBooking || !traineeName?.trim()}
              className={`flex-1 py-2 px-4 rounded-md text-primary-foreground font-medium transition-colors ${
                isBooking || !traineeName?.trim()
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {isBooking ? 'Booking...' : 'Book Slot'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isBooking}
              className="flex-1 py-2 px-4 rounded-md bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
