import React, { useState, useEffect, useRef } from 'react';
import { searchContacts } from '../api';

const ContactSearch = ({ onContactSelect, selectedContact, placeholder = "Search for student..." }) => {
    const [query, setQuery] = useState('');
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Debounce search
    useEffect(() => {
        const trimmedQuery = query.trim();
        
        // Shorter debounce for longer queries (likely pasted)
        const debounceTime = trimmedQuery.length > 10 ? 100 : 300;
        
        const timeoutId = setTimeout(() => {
            if (trimmedQuery.length >= 2) {
                performSearch(trimmedQuery);
            } else {
                setContacts([]);
                setShowSuggestions(false);
            }
        }, debounceTime);

        return () => clearTimeout(timeoutId);
    }, [query]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) && 
                inputRef.current && !inputRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const performSearch = async (searchQuery) => {
        console.log('🔍 ContactSearch: Searching for:', searchQuery);
        setIsLoading(true);
        setError(null);
        try {
            const results = await searchContacts(searchQuery, 10);
            console.log('✅ ContactSearch: Found', results.length, 'contacts');
            setContacts(results);
            setShowSuggestions(true);
        } catch (err) {
            console.error('❌ ContactSearch: Search failed:', err);
            setError('Failed to search contacts');
            setContacts([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        
        // If user clears the input, clear selection
        if (!value.trim()) {
            onContactSelect(null);
        }
    };

    const handleContactSelect = (contact) => {
        setQuery(''); // Clear the search field
        setShowSuggestions(false);
        setContacts([]); // Clear suggestions
        onContactSelect(contact);
    };

    const handleClear = () => {
        setQuery('');
        setContacts([]);
        setShowSuggestions(false);
        onContactSelect(null);
        inputRef.current?.focus();
    };

    const getPaymentStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'paid':
            case 'completed':
                return 'text-green-600 bg-green-100';
            case 'pending':
            case 'processing':
                return 'text-yellow-600 bg-yellow-100';
            case 'unpaid':
            case 'overdue':
                return 'text-red-600 bg-red-100';
            default:
                return 'text-gray-600 bg-gray-100';
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
                        onFocus={() => query.trim().length >= 2 && setShowSuggestions(true)}
                        placeholder="Search by name, email, or student ID..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                {query && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                )}
                {isLoading && (
                    <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    </div>
                )}
            </div>

            {showSuggestions && contacts.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                >
                    {contacts.map((contact) => (
                        <div
                            key={contact.id}
                            onClick={() => handleContactSelect(contact)}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">
                                            {contact.fullName}
                                        </span>
                                        {contact.studentId && (
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                ID: {contact.studentId}
                                            </span>
                                        )}
                                    </div>
                                    {contact.email && (
                                        <div className="text-sm text-gray-500">
                                            {contact.email}
                                        </div>
                                    )}
                                    {contact.phone && (
                                        <div className="text-sm text-gray-500">
                                            {contact.phone}
                                        </div>
                                    )}
                                </div>
                                <div className="ml-2 flex flex-col items-end space-y-1">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(contact.paymentStatus)}`}>
                                        {contact.paymentStatus || 'Unknown'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {contact.lifeCycleStage}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showSuggestions && !isLoading && query.trim().length >= 2 && contacts.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    <div className="px-4 py-3 text-gray-500 text-center">
                        No contacts found for "{query}"
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-1 text-sm text-red-600">
                    {error}
                </div>
            )}

            {selectedContact && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="font-medium text-blue-900">
                                Selected: {selectedContact.fullName}
                            </div>
                            <div className="text-sm text-blue-700">
                                Payment Status: {selectedContact.paymentStatus || 'Unknown'}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-blue-600 hover:text-blue-800 text-sm"
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
