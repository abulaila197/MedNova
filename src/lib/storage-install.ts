// Gives phones a lasting localStorage (SQLite-backed), so sign-in and saved plays survive a restart.
// Imported first in the root layout, before anything reads localStorage.
import 'expo-sqlite/localStorage/install';
