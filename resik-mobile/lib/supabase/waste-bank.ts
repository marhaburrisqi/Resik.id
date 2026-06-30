import { supabase } from './client';
import { WasteBankPickup } from '../../types/waste-bank';

export const wasteBankApi = {
  async getAllPickups(page: number = 1, pageSize: number = 20) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Silakan login terlebih dahulu');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return data as WasteBankPickup[];
  },
};
