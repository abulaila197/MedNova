import { router } from 'expo-router';
import { View } from 'react-native';

import { Back } from '@/features/learn/Back';
import { GAMES } from '@/data/games';
import { u } from '@/theme/scale';

import type { Mode } from '../engine/types';
import { Body, Btn, Card, GameScreen, Ghost, Kick, Title } from './ui';


/** Rules 19-20: after 3 guest plays of a mode, sign in before setup. Guest plays carry over. */
export function TrialGate({ game, mode }: { game: string; mode: Mode }) {
  const g = GAMES.find((x) => x.key === game);
  const online = mode === 'online';
  return (
    <GameScreen>
      <Back label={g ? `${g.lead} ${g.em}` : 'Games'} fallback={`/play/${game}`} />
      <Card style={{ marginTop: u(24), gap: u(10) }}>
        <Kick>{online ? 'Online Multiplayer' : 'Free plays used'}</Kick>
        <Title lead={online ? 'Sign in to' : 'Keep'} em={online ? 'race' : 'playing'} size={26} />
        <Body>
          {online
            ? 'Online Multiplayer needs an account so other players see your name and your results are kept.'
            : 'You have played your 3 free Solo and Offline Multiplayer games. Sign in to keep going. Your misses, points and EXP from these games come with you.'}
        </Body>
        <View style={{ gap: u(8), marginTop: u(4) }}>
          <Btn label="Sign in" onPress={() => router.push('/auth')} />
          <Ghost label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/play/${game}`))} />
        </View>
      </Card>
    </GameScreen>
  );
}
