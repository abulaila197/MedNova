import { Dimensions } from 'react-native';

// Every locked design was drawn on a 282px-wide phone screen. Sizes in the
// app are written in those design pixels and scaled to the real screen width,
// so each device shows the same proportions as the approved previews.
export const DESIGN_WIDTH = 282;
const { width } = Dimensions.get('window');
export const SCREEN_W = width;
export const K = width / DESIGN_WIDTH;
export const u = (n: number) => n * K;
