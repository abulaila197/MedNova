import { supabase } from '@/lib/supabase';

/** One server function call (Supabase RPC). */
export const call = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

/** One request to an edge function (account removal, store checks). */
export const invoke = async <T = unknown>(fn: string, body?: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke(fn, { method: 'POST', body });
  if (error) throw error;
  return data as T;
};
