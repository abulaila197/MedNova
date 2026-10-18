// The account deletion Edge Function (SO1, SO2).
// Invoked by src/state/account.ts to securely delete the authenticated user
// from auth.users, causing all linked profile and player data to cascade.
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: {
  env: { get(k: string): string | undefined };
  serve(h: (req: Request) => Promise<Response>): void;
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok');

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who, error: authError } = await admin.auth.getUser(jwt);

  if (authError || !who?.user) {
    return json({ result: 'unauthorized' }, 401);
  }

  const userId = who.user.id;

  // Delete the user from auth.users using admin privileges.
  // Foreign keys with ON DELETE CASCADE remove associated records.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ result: 'error', message: deleteError.message }, 500);
  }

  return json({ result: 'ok', user_id: userId });
});
