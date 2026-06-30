import { useState, useEffect } from 'react';
import { TrashReport } from '../types/citizen';
import { citizenApi } from '../lib/supabase/citizen';
import { logger } from '../utils/logger';

export function useCitizen() {
  const [reports, setReports] = useState<TrashReport[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch newest 20 reports from live database
      const data = await citizenApi.getReports(1, 20);
      setReports(data);
      
      // Fetch points balance
      const points = await citizenApi.getWalletBalance();
      setBalance(points);
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil data setoran');
      logger.error('Failed to refresh data in useCitizen hook', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  async function submitReport(report: any) {
    setLoading(true);
    try {
      const result = await citizenApi.createReport(report);
      await refreshData();
      return result;
    } catch (err: any) {
      logger.error('Failed to submit report in useCitizen hook', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return {
    reports,
    balance,
    loading,
    error,
    refreshData,
    submitReport,
  };
}
