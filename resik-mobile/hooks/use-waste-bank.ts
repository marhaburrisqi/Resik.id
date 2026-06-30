import { useState, useEffect, useCallback } from 'react';
import { TrashReport } from '../types/citizen';
import { MOCK_REPORTS } from '../constants/mock-data';

export function useWasteBank() {
  const [pickups, setPickups] = useState<TrashReport[]>(MOCK_REPORTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchPickups = useCallback(async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setPickups(MOCK_REPORTS);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  return {
    pickups,
    loading,
    error,
    hasMore,
    fetchPickups,
    loadMore: () => {},
  };
}
