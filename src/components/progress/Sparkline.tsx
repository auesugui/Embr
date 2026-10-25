// =============================================================================
// Sparkline — one exercise's shape, 56×20
// =============================================================================
// Scaled to the exercise's OWN min and max, not to a shared axis. At this size
// nothing can be read off it as a number, so the only thing it can honestly
// carry is direction — and a shared axis would flatten every light movement
// into a straight line next to the squats.
//
// A constant series draws down the middle rather than along the floor: there is
// no trend to show, and a line pinned to the bottom reads as a collapse.

import Svg, { Polyline } from 'react-native-svg';

import { roles } from '@/theme';

const WIDTH = 56;
const HEIGHT = 20;
/** Keeps the round cap of the first and last point inside the box. */
const INSET = 2;

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const top = INSET;
  const bottom = HEIGHT - INSET;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * WIDTH;
      const y = span === 0 ? HEIGHT / 2 : bottom - ((value - min) / span) * (bottom - top);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <Polyline
        points={points}
        fill="none"
        stroke={roles.accent}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
