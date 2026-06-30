import { supabase } from './client';
import { TrashReport, CreateReportDTO } from '../../types/citizen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';

const DRAFT_KEY = 'resik_report_wizard_draft';

export const citizenApi = {
  // 1. Create a new waste report in Supabase
  async createReport(report: CreateReportDTO): Promise<TrashReport> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Silakan login terlebih dahulu untuk menyetor sampah.');

    // Build description that includes GPS metadata not yet in live schema.
    // Columns missing from live DB: accuracy, loc_timestamp, source,
    // storage_path, tracking_id. Embed them in description JSON so no
    // data is lost. Once migration runs these become dedicated columns.
    const gpsMetadata = {
      accuracy: report.accuracy,
      loc_timestamp: report.loc_timestamp,
      source: report.source ?? 'device',
      tracking_id: report.tracking_id,
      storage_path: report.storage_path,
    };
    const enrichedDescription = report.description
      ? `${report.description}\n__meta:${JSON.stringify(gpsMetadata)}`
      : `__meta:${JSON.stringify(gpsMetadata)}`;

    // Only include columns that are confirmed to exist in the live database.
    // Sending an unknown column causes a PostgREST 42703 schema cache error.
    const payload: Record<string, unknown> = {
      idempotency_key: report.idempotency_key,
      citizen_id: user.id,
      report_type: report.report_type ?? 'trash',
      trash_type: report.trash_type,
      estimated_weight: report.estimated_weight,
      location_lat: report.location_lat,
      location_lng: report.location_lng,
      address: report.address || 'Alamat akan dilengkapi saat internet tersedia',
      photo_url: report.photo_url ?? null,
      status: 'pending',
      description: enrichedDescription,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('reports')
      .upsert([payload], { onConflict: 'idempotency_key' })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create report in Supabase', error);
      throw new Error(`Gagal menyimpan laporan: ${error.message}`);
    }

    // Reconstruct full TrashReport merging DB row with local-only fields
    return {
      ...data,
      accuracy: report.accuracy,
      loc_timestamp: report.loc_timestamp,
      source: report.source ?? 'device',
      tracking_id: report.tracking_id,
      storage_path: report.storage_path,
    } as TrashReport;
  },


  // 2. Fetch paginated reports for the authenticated citizen
  async getReports(page: number = 1, pageSize: number = 20): Promise<TrashReport[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesi Anda telah kedaluwarsa. Silakan login kembali.');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('citizen_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('Failed to retrieve reports from Supabase', error);
      throw new Error(`Gagal mengambil daftar laporan: ${error.message}`);
    }

    return data as TrashReport[];
  },

  // 3. Fetch a single report by ID
  async getReportById(id: string): Promise<TrashReport> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error(`Failed to fetch report by ID: ${id}`, error);
      throw new Error(`Laporan tidak ditemukan: ${error.message}`);
    }

    return data as TrashReport;
  },

  // 4. Update the status of a report
  async updateReportStatus(id: string, status: string): Promise<TrashReport> {
    const { data, error } = await supabase
      .from('reports')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error(`Failed to update status for report: ${id}`, error);
      throw new Error(`Gagal mengubah status laporan: ${error.message}`);
    }

    return data as TrashReport;
  },

  // 5. Get current points balance for authenticated citizen
  async getWalletBalance(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('users')
      .select('points')
      .eq('id', user.id)
      .single();

    if (error) {
      logger.error('Failed to fetch wallet points balance', error);
      return 0;
    }

    if (!data) return 0;
    return data.points || 0;
  },

  // 6. Save report draft to local device storage (Offline draft)
  async saveDraft(draft: any): Promise<void> {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      logger.info('Report draft cached locally in AsyncStorage');
    } catch (err) {
      logger.error('Failed to write report draft to local storage', err);
      throw new Error('Gagal menyimpan draf laporan ke memori HP');
    }
  },

  // 7. Retrieve report draft from local device storage
  async restoreDraft(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(DRAFT_KEY);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error('Failed to restore report draft from local storage', err);
      return null;
    }
  },

  // 8. Delete report draft from local device storage
  async deleteDraft(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
      logger.info('Local report draft cleared successfully');
    } catch (err) {
      logger.error('Failed to delete report draft from local storage', err);
    }
  }
};
