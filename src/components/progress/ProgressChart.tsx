// =============================================================================
// ProgressChart — the heaviest-set line for one exercise
// =============================================================================
// Three gridlines, two labelled x positions, one series. Deliberately spare:
// this is the only chart in the app and the thing it has to answer is "is the
// number going up", which a grid of twelve lines does not answer faster.
//
// The y domain comes from `chartAxis` — the data's own range, widened to round
// gridline values. Drawn at the measured pixel width rather than scaled from a
// fixed viewBox: a stretched viewBox would stretch the axis labels with it.

import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import {
  type ProgressMetric,
  type ProgressPoint,
  chartAxis,
  formatProgressAxis,
  formatProgressDate,
  formatProgressValue,
} from '@/lib/exercise-progress';
import { fontFamilies, roles } from '@/theme';
import type { WeightUnit } from '@/types';

/** Height as a fraction of width — the mockup's 300×158 proportion. */
const ASPECT = 158 / 300;
const PAD = { top: 10, right: 8, bottom: 30, left: 34 };
/** Room for the end-point dot and its ring. */
const DOT_R = 4.5;

export function ProgressChart({
  points,
  metric,
  units,
  name,
}: {
  /** Oldest first, at least one. */
  points: ProgressPoint[];
  metric: ProgressMetric;
  units: WeightUnit;
  /** Used in the accessible description, which is the whole chart to a reader. */
  name: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const height = Math.round(width * ASPECT);

  if (width === 0 || points.length === 0) {
    return <View onLayout={onLayout} style={styles.placeholder} />;
  }

  const axis = chartAxis(points.map((point) => point.value));
  const plotLeft = PAD.left;
  const plotRight = width - PAD.right - DOT_R;
  const plotTop = PAD.top;
  const plotBottom = height - PAD.bottom;

  const xFor = (index: number) =>
    points.length === 1
      ? (plotLeft + plotRight) / 2
      : plotLeft + (index / (points.length - 1)) * (plotRight - plotLeft);
  const yFor = (value: number) =>
    plotBottom - ((value - axis[0]) / (axis[2] - axis[0])) * (plotBottom - plotTop);

  const coords = points.map((point, index) => ({ x: xFor(index), y: yFor(point.value) }));
  const line = coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `M${coords.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} L${coords[coords.length - 1].x.toFixed(1)} ${plotBottom} L${coords[0].x.toFixed(1)} ${plotBottom} Z`;
  const end = coords[coords.length - 1];

  const first = points[0];
  const last = points[points.length - 1];
  const trend = last.value > first.value ? 'rising' : last.value < first.value ? 'falling' : 'flat';
  const label =
    points.length === 1
      ? `${name}: one session, ${formatProgressValue(last.value, metric, units)} on ${formatProgressDate(last.timestamp)}`
      : `${name} per session, ${trend} from ${formatProgressValue(first.value, metric, units)} on ${formatProgressDate(first.timestamp)} to ${formatProgressValue(last.value, metric, units)} on ${formatProgressDate(last.timestamp)}`;

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height} accessibilityRole="image" accessibilityLabel={label}>
        {axis.map((value) => (
          <Line
            key={value}
            x1={plotLeft}
            y1={yFor(value)}
            x2={width - PAD.right}
            y2={yFor(value)}
            stroke={roles.border}
            strokeWidth={1}
          />
        ))}
        {axis.map((value) => (
          <SvgText
            key={value}
            x={plotLeft - 6}
            y={yFor(value) + 3.5}
            textAnchor="end"
            fill={roles.textMuted}
            fontSize={10}
            fontFamily={fontFamilies.regular}
          >
            {formatProgressAxis(value, metric)}
          </SvgText>
        ))}

        {points.length > 1 && (
          <>
            <Path d={area} fill={roles.accent} fillOpacity={0.1} />
            <Polyline
              points={line}
              fill="none"
              stroke={roles.accent}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        <Circle
          cx={end.x}
          cy={end.y}
          r={DOT_R}
          fill={roles.accent}
          stroke={roles.surfaceRaised}
          strokeWidth={2}
        />

        {/* First and last only. A label per session is unreadable by the
            fourth one, and the shape is what the middle of the axis carries. */}
        <SvgText
          x={points.length === 1 ? end.x : plotLeft}
          y={height - 10}
          textAnchor={points.length === 1 ? 'middle' : 'start'}
          fill={roles.textMuted}
          fontSize={10}
          fontFamily={fontFamilies.regular}
        >
          {formatProgressDate(first.timestamp)}
        </SvgText>
        {points.length > 1 && (
          <SvgText
            x={width - PAD.right}
            y={height - 10}
            textAnchor="end"
            fill={roles.textMuted}
            fontSize={10}
            fontFamily={fontFamilies.regular}
          >
            {formatProgressDate(last.timestamp)}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Holds the row's height for the one frame before onLayout reports a width.
  placeholder: {
    height: 160,
  },
});
