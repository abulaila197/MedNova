// Gives phones a lasting localStorage (SQLite-backed), so sign-in and saved plays survive a restart.
// Imported by the app entry (index.js) before any other module, and again by modules that read
// localStorage at load time (lib/supabase.ts), so the order can't silently break again (PB1).
import 'expo-sqlite/localStorage/install';
