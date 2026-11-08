// App entry. The lasting localStorage must exist before ANY app module runs: expo-router evaluates
// every _layout file while building its route tree ((app)/_layout before the root one), and modules
// such as lib/supabase.ts and engine defaultKV() capture localStorage when they load (PB1).
// expo-router/entry is imported last, as the Expo Router docs ask for a custom entry file.
import './src/lib/storage-install';
import 'expo-router/entry';
