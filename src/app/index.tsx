import { Redirect } from 'expo-router';

import { firstRoute } from '@/state/start';

export default function Index() {
  return <Redirect href={firstRoute()} />;
}
