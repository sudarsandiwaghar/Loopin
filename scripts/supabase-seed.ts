import dotenv from 'dotenv';
dotenv.config();

import { isSupabaseConfigured, testSupabaseConnection } from '../server/supabase.ts';
import { dbManager } from '../server/db.ts';
import { pushDatabaseToSupabase } from '../server/supabaseSync.ts';

async function main() {
  console.log('=====================================================');
  console.log('  Loopin -> Supabase Cloud Database Seeder');
  console.log('=====================================================');

  if (!isSupabaseConfigured()) {
    console.error('\n[Error] Supabase credentials not found in environment.');
    console.error('Please configure the following in your .env file or Vercel environment:');
    console.error('  SUPABASE_URL=https://xyz.supabase.co');
    console.error('  SUPABASE_ANON_KEY=eyJhbGciOi...');
    console.error('\nTip: You can also use SUPABASE_SERVICE_ROLE_KEY for administrative migrations.');
    process.exit(1);
  }

  console.log('\n[1/3] Testing connection to Supabase...');
  const connStatus = await testSupabaseConnection();
  console.log(`[Status] ${connStatus.message}`);

  console.log('\n[2/3] Reading reference institutional data...');
  const data = dbManager.getDb();
  console.log(`  - Institutions: ${data.institutions.length}`);
  console.log(`  - Users: ${data.users.length}`);
  console.log(`  - Workflow Templates: ${data.templates.length}`);
  console.log(`  - Active Requests: ${data.requests.length}`);
  console.log(`  - Audit Log Entries: ${data.auditLogs.length}`);

  console.log('\n[3/3] Synchronizing data to Supabase...');
  const res = await pushDatabaseToSupabase(data);

  if (res.success) {
    console.log('\nSUCCESS! All tables and reference records pushed to Supabase Cloud.');
    console.log('Your Loopin deployment is now fully backed by Supabase.');
  } else {
    console.error(`\nFAILED to push state: ${res.error}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
