import { useQuery } from '@tanstack/react-query';
import { searchContacts, getContactById } from '../api';

export function useContactSearch(query) {
  return useQuery({
    queryKey: ['contacts', 'search', query],
    queryFn: () => searchContacts(query),
    enabled: query.length >= 2,
  });
}

export function useContact(contactId) {
  return useQuery({
    queryKey: ['contacts', contactId],
    queryFn: () => getContactById(contactId),
    enabled: !!contactId,
  });
}
