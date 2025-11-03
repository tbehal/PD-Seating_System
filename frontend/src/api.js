import axios from 'axios';
import { API_BASE } from './config';

/**
 * Finds available lab combinations based on search criteria.
 * @param {object} criteria - The search parameters.
 * @returns {Promise<Array>} A promise that resolves to an array of available combinations.
 */
export async function findCombinations(criteria) {
    try {
        const res = await axios.post(`${API_BASE}/api/availability/find`, criteria);
        return res.data;
    } catch (error) {
        console.error('Error finding combinations:', error.response?.data?.error || error.message);
        // In a real app, you might want to throw the error to be handled by the component
        // or return a specific error object.
        return []; // Return empty array on failure
    }
}

/**
 * Fetches the availability grid for a specific lab and shift.
 * @param {string} lab - The lab to fetch the grid for.
 * @param {string} shift - The shift (e.g., 'AM' or 'PM').
 * @returns {Promise<object|null>} A promise that resolves to the grid data or null on error.
 */
export async function fetchGrid(lab, shift) {
    try {
        const res = await axios.post(`${API_BASE}/api/availability/grid`, { lab, shift });
        return res.data;
    } catch (error) {
        console.error('Error fetching grid:', error.response?.data?.error || error.message);
        return null;
    }
}

/**
 * Books a lab slot for a trainee.
 * @param {object} bookingDetails - The details of the booking.
 * @returns {Promise<object>} A promise that resolves to the server's response.
 */
export async function bookSlot(bookingDetails) {
    // The component will handle the full error response
    return await axios.post(`${API_BASE}/api/availability/book`, bookingDetails);
}

/**
 * Unbooks a lab slot (clears trainee name) for given lab/station/shift/weeks.
 * @param {object} details - { lab, station, shift, weeks }
 * @returns {Promise<object>} A promise that resolves to the server's response.
 */
export async function unbookSlot(details) {
    return await axios.post(`${API_BASE}/api/availability/unbook`, details);
}

/**
 * Invalidates the server-side cache.
 * @returns {Promise<object>} A promise that resolves to the server's response.
 */
export async function invalidateCache() {
    try {
        const res = await axios.post(`${API_BASE}/api/availability/invalidate`);
        return res.data;
    } catch (error) {
        console.error('Error invalidating cache:', error.response?.data?.error || error.message);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Searches for contacts in HubSpot by name.
 * @param {string} query - The search query.
 * @param {number} limit - Maximum number of results to return.
 * @returns {Promise<Array>} A promise that resolves to an array of contacts.
 */
export async function searchContacts(query, limit = 10) {
    try {
        const res = await axios.get(`${API_BASE}/api/availability/contacts/search`, {
            params: { q: query, limit }
        });
        return res.data;
    } catch (error) {
        console.error('Error searching contacts:', error.response?.data?.error || error.message);
        return [];
    }
}

/**
 * Gets a contact by ID from HubSpot.
 * @param {string} contactId - The contact ID.
 * @returns {Promise<object|null>} A promise that resolves to the contact data or null on error.
 */
export async function getContactById(contactId) {
    try {
        const res = await axios.get(`${API_BASE}/api/availability/contacts/${contactId}`);
        return res.data;
    } catch (error) {
        console.error('Error getting contact:', error.response?.data?.error || error.message);
        return null;
    }
}

/**
 * Searches for a contact by name in HubSpot.
 * @param {string} name - The contact name to search for.
 * @param {number} limit - Maximum number of results to return.
 * @returns {Promise<object|null>} A promise that resolves to the contact data or null on error.
 */
export async function searchContactByName(name, limit = 5) {
    try {
        const res = await axios.get(`${API_BASE}/api/availability/contacts/search`, {
            params: { q: name, limit }
        });
        if (res.data && res.data.length > 0) {
            // Try to find exact match first (case-insensitive)
            const exactMatch = res.data.find(contact => 
                contact.fullName.toLowerCase() === name.toLowerCase()
            );
            if (exactMatch) return exactMatch;
            
            // Try to find best partial match
            const bestMatch = res.data.find(contact => 
                contact.fullName.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(contact.fullName.toLowerCase())
            );
            if (bestMatch) return bestMatch;
            
            // Return first result as fallback
            return res.data[0];
        }
        return null;
    } catch (error) {
        console.error('Error searching contact by name:', error.response?.data?.error || error.message);
        return null;
    }
}

/**
 * Updates a contact's payment status in HubSpot.
 * @param {string} contactId - The contact ID.
 * @param {string} paymentStatus - The new payment status.
 * @returns {Promise<object>} A promise that resolves to the server's response.
 */
export async function updateContactPaymentStatus(contactId, paymentStatus) {
    try {
        const res = await axios.patch(`${API_BASE}/api/availability/contacts/${contactId}/payment-status`, {
            paymentStatus
        });
        return res.data;
    } catch (error) {
        console.error('Error updating payment status:', error.response?.data?.error || error.message);
        throw error;
    }
}

/**
 * Exports the Excel file.
 * @returns {Promise<void>}
 */
export async function exportExcel() {
    try {
        const res = await axios.get(`${API_BASE}/api/availability/export`, {
            responseType: 'blob'
        });
        
        // Create a download link
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `availability-${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting Excel:', error.response?.data?.error || error.message);
        throw error;
    }
}

/**
 * Resets all bookings across the sheet.
 * @returns {Promise<object>}
 */
export async function resetAllBookings() {
    try {
        const res = await axios.post(`${API_BASE}/api/availability/reset`);
        return res.data;
    } catch (error) {
        console.error('Error resetting all bookings:', error.response?.data?.error || error.message);
        throw error;
    }
}
