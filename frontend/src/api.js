import axios from 'axios';
import { API_BASE } from './config';

axios.defaults.withCredentials = true;

// 401 interceptor — notify app of unauthorized responses
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);

// --- Auth endpoints ---

export async function login(password) {
  const res = await axios.post(`${API_BASE}/api/auth/login`, { password });
  return res.data;
}

export async function logout() {
  const res = await axios.post(`${API_BASE}/api/auth/logout`);
  return res.data;
}

export async function checkAuth() {
  try {
    const res = await axios.get(`${API_BASE}/api/auth/check`);
    return res.data?.data?.authenticated === true;
  } catch {
    return false;
  }
}

// --- Cycle endpoints ---

export async function fetchCycles() {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/cycles`);
    return res.data.data;
  } catch (error) {
    console.error('Error fetching cycles:', error.response?.data?.error || error.message);
    return [];
  }
}

export async function createCycle(year, courseCodes = []) {
  const res = await axios.post(`${API_BASE}/api/v1/cycles`, { year, courseCodes });
  return res.data.data;
}

export async function lockCycle(cycleId) {
  const res = await axios.patch(`${API_BASE}/api/v1/cycles/${cycleId}/lock`);
  return res.data.data;
}

export async function unlockCycle(cycleId) {
  const res = await axios.patch(`${API_BASE}/api/v1/cycles/${cycleId}/unlock`);
  return res.data.data;
}

export async function deleteCycle(cycleId) {
  const res = await axios.delete(`${API_BASE}/api/v1/cycles/${cycleId}`);
  return res.data.data;
}

export async function updateCycleWeeks(cycleId, weeks) {
  const res = await axios.patch(`${API_BASE}/api/v1/cycles/${cycleId}/weeks`, { weeks });
  return res.data.data;
}

// --- Availability endpoints (all require cycleId) ---

export async function findCombinations({
  cycleId,
  shift,
  labType,
  side,
  startWeek,
  endWeek,
  weeksNeeded,
}) {
  try {
    const res = await axios.post(`${API_BASE}/api/v1/availability/find`, {
      cycleId,
      shift,
      labType,
      side,
      startWeek: parseInt(startWeek, 10),
      endWeek: parseInt(endWeek, 10),
      weeksNeeded: parseInt(weeksNeeded, 10),
    });
    return res.data.data;
  } catch (error) {
    console.error('Error finding combinations:', error.response?.data?.error || error.message);
    return [];
  }
}

export async function fetchGrid(cycleId, shift, labType, side) {
  try {
    const res = await axios.post(`${API_BASE}/api/v1/availability/grid`, {
      cycleId,
      shift,
      labType,
      side,
    });
    return res.data.data;
  } catch (error) {
    console.error('Error fetching grid:', error.response?.data?.error || error.message);
    return null;
  }
}

export async function bookSlot({ cycleId, stationId, shift, weeks, traineeName, contactId }) {
  const res = await axios.post(`${API_BASE}/api/v1/availability/book`, {
    cycleId,
    stationId,
    shift,
    weeks,
    traineeName,
    contactId,
  });
  return res.data;
}

export async function unbookSlot({ cycleId, stationId, shift, weeks }) {
  const res = await axios.post(`${API_BASE}/api/v1/availability/unbook`, {
    cycleId,
    stationId,
    shift,
    weeks,
  });
  return res.data;
}

export async function resetAllBookings(cycleId) {
  try {
    const res = await axios.post(`${API_BASE}/api/v1/availability/reset`, { cycleId });
    return res.data.data;
  } catch (error) {
    console.error('Error resetting all bookings:', error.response?.data?.error || error.message);
    throw error;
  }
}

export async function exportCycle(cycleId, { shift, labType, side } = {}) {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/availability/export`, {
      params: { cycleId, shift, labType, side },
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cycle-${cycleId}-export.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting cycle:', error.response?.data?.error || error.message);
    throw error;
  }
}

// --- Registration List endpoints ---

export async function fetchRegistrationList(cycleId, shift, refresh = false) {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/cycles/${cycleId}/registration`, {
      params: { shift, ...(refresh && { refresh: 'true' }) },
    });
    return res.data.data;
  } catch (error) {
    console.error(
      'Error fetching registration list:',
      error.response?.data?.error || error.message,
    );
    throw error;
  }
}

export async function exportRegistrationList(cycleId, shift) {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/cycles/${cycleId}/registration/export`, {
      params: { shift },
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `registration-${cycleId}-${shift}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(
      'Error exporting registration list:',
      error.response?.data?.error || error.message,
    );
    throw error;
  }
}

export async function updateCourseCodes(cycleId, courseCodes) {
  const res = await axios.patch(`${API_BASE}/api/v1/cycles/${cycleId}/course-codes`, {
    courseCodes,
  });
  return res.data.data;
}

// --- Analytics endpoints ---

export async function fetchSeatingAnalytics(year, cycleId = null) {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/analytics/seating`, {
      params: { year, ...(cycleId && { cycleId }) },
    });
    return res.data.data;
  } catch (error) {
    console.error(
      'Error fetching seating analytics:',
      error.response?.data?.error || error.message,
    );
    throw error;
  }
}

export async function fetchRegistrationAnalytics(year, shift, cycleId = null) {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/analytics/registration`, {
      params: { year, shift, ...(cycleId && { cycleId }) },
    });
    return res.data.data;
  } catch (error) {
    console.error(
      'Error fetching registration analytics:',
      error.response?.data?.error || error.message,
    );
    throw error;
  }
}

// --- HubSpot Contact endpoints (unchanged) ---

export async function searchContacts(query, limit = 10) {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/availability/contacts/search`, {
      params: { q: query, limit },
    });
    return res.data.data;
  } catch (error) {
    console.error('Error searching contacts:', error.response?.data?.error || error.message);
    return [];
  }
}

export async function getContactById(contactId) {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/availability/contacts/${contactId}`);
    return res.data.data;
  } catch (error) {
    console.error('Error getting contact:', error.response?.data?.error || error.message);
    return null;
  }
}

export async function searchContactByName(name, limit = 5) {
  try {
    const res = await axios.get(`${API_BASE}/api/v1/availability/contacts/search`, {
      params: { q: name, limit },
    });
    if (res.data.data && res.data.data.length > 0) {
      const exactMatch = res.data.data.find(
        (contact) => contact.fullName.toLowerCase() === name.toLowerCase(),
      );
      if (exactMatch) return exactMatch;

      const bestMatch = res.data.data.find(
        (contact) =>
          contact.fullName.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(contact.fullName.toLowerCase()),
      );
      if (bestMatch) return bestMatch;

      return res.data.data[0];
    }
    return null;
  } catch (error) {
    console.error('Error searching contact by name:', error.response?.data?.error || error.message);
    return null;
  }
}

export async function updateContactPaymentStatus(contactId, paymentStatus) {
  try {
    const res = await axios.patch(
      `${API_BASE}/api/v1/availability/contacts/${contactId}/payment-status`,
      {
        paymentStatus,
      },
    );
    return res.data.data;
  } catch (error) {
    console.error('Error updating payment status:', error.response?.data?.error || error.message);
    throw error;
  }
}
