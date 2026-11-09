import { router } from 'expo-router';
import { View } from 'react-native';

import { Back } from '@/components/Back';
import { GAMES } from '@/data/games';
import { u } from '@/theme/scale';

import type { Mode } from '../engine/types';
import { Body, Btn, Card, GameScreen, Ghost, Kick, Title } from './ui';


/** #83: after a guest's 5 free plays (all games together), sign in before setup. Guest plays carry over. */
export function TrialGate({ game, mode }: { game: string; mode: Mode }) {
  const g = GAMES.find((x) => x.key === game);
  return (
    <GameScreen>
      <Back label={g ? `${g.lead} ${g.em}` : 'Games'} fallback={`/play/${game}`} />
      <Card style={{ marginTop: u(24), gap: u(10) }}>
        <Kick>Free plays used</Kick>
        <Title lead="Sign in to" em="play more" size={26} />
        <Body>
          {'You have used your 5 free plays. Sign in to play with Sparks: a full bar of 100 that refills on its own. Your misses, points and EXP from your plays come with you.'}
        </Body>
        <View style={{ gap: u(8), marginTop: u(4) }}>
          <Btn label="Sign in" onPress={() => router.push('/auth')} />
          <Ghost label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace(`/play/${game}`))} />
        </View>
      </Card>
    </GameScreen>
  );
}
