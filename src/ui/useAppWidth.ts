import { useWindowDimensions } from 'react-native';
import { MAX_APP_WIDTH } from './theme';

/** Usable width of the app: the window on phones, capped on web. */
export function useAppWidth(): number {
  return Math.min(useWindowDimensions().width, MAX_APP_WIDTH);
}
