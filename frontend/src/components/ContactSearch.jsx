import React, { useState, useEffect, useRef } from 'react';
import { useContactSearch } from '../hooks/useContacts';

const ContactSearch = ({
  onContactSelect,
  selectedContact,
  placeholder = 'Search for student...',
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Debounce: shorter for longer queries (likely pasted)
  useEffect(() => {
    const trimmedQuery = query.trim();
    const debounceTime = trimmedQuery.length > 10 ? 100 : 300;

    const timeoutId = setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
      if (trimmedQuery.length < 2) {
        setShowSuggestions(false);
      }
    }, debounceTime);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const { data: contacts = [], isLoading } = useContactSearch(debouncedQuery);

  useEffect(() => {
    if (contacts.length > 0 && debouncedQuery.length >= 2) {
      setShowSuggestions(true);
    }
  }, [contacts, debouncedQuery]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (!value.trim()) {
      onContactSelect(null);
    }
  };

  const handleContactSelect = (contact) => {
    setQuery('');
    setDebouncedQuery('');
    setShowSuggestions(false);
    onContactSelect(contact);
  };

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    setShowSuggestions(false);
    onContactSelect(null);
    inputRef.current?.focus();
  };

  const getPaymentStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'text-success bg-success-muted';
      case 'pending':
      case 'processing':
        return 'text-warning bg-warning-muted';
      case 'unpaid':
      case 'overdue':
        return 'text-destructive bg-destructive-muted';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() =>
            debouncedQuery.length >= 2 && contacts.length > 0 && setShowSuggestions(true)
          }
          placeholder="Search by name, email, or student ID..."
          className="w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
          >
            ✕
          </button>
        )}
        {isLoading && (
          <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {showSuggestions && contacts.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-card border border-input rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {contacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => handleContactSelect(contact)}
              className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border/50 last:border-b-0"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{contact.fullName}</span>
                    {contact.studentId && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        ID: {contact.studentId}
                      </span>
                    )}
                  </div>
                  {contact.email && (
                    <div className="text-sm text-muted-foreground">{contact.email}</div>
                  )}
                  {contact.phone && (
                    <div className="text-sm text-muted-foreground">{contact.phone}</div>
                  )}
                </div>
                <div className="ml-2 flex flex-col items-end space-y-1">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(contact.paymentStatus)}`}
                  >
                    {contact.paymentStatus || 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground">{contact.lifeCycleStage}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showSuggestions && !isLoading && debouncedQuery.length >= 2 && contacts.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-input rounded-md shadow-lg">
          <div className="px-4 py-3 text-muted-foreground text-center">
            No contacts found for "{query}"
          </div>
        </div>
      )}

      {selectedContact && (
        <div className="mt-2 p-3 bg-info-muted border border-info/30 rounded-md">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-foreground">
                Selected: {selectedContact.fullName}
              </div>
              <div className="text-sm text-muted-foreground">
                Payment Status: {selectedContact.paymentStatus || 'Unknown'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-info hover:text-info/80 text-sm"
            >
              Change
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactSearch;
