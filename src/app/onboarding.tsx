import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function Onboarding() {
  return (
    <View style={{ flex: 1, backgroundColor: '#070a1c', padding: 40 }}>
      <Link href="/games"><Text style={{ color: '#fff' }}>onboarding → games</Text></Link>
    </View>
  );
}
