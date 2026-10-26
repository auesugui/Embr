// =============================================================================
// HistoryCalendar — the month above the History list
// =============================================================================
// A readout first: which days you trained this month. Tapping a day is what
// filters the list; stepping to another month only changes what you are looking
// at. One mark per day, never an intensity — "did I train" is the question this
// card answers, and the strip under it answers "how much".
//
// Collapsed it keeps a single week row, the selected day's week or today's,
// whatever month is being browsed, so the date being filtered by stays on
// screen while the list scrolls.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from '@/components/icons';
import { type CalendarDay, calendarRows, formatDayLabel } from '@/lib/history-calendar';
import { WEEK_DAY_INITIALS } from '@/lib/local-week';
import { radius, roles, spacing, textStyles } from '@/theme';

/** Stable ids: the initials repeat, and so would keys built from them. */
const WEEKDAY_CELLS = WEEK_DAY_INITIALS.map((letter, index) => ({
  id: `weekday-${index}`,
  letter,
}));

export function HistoryCalendar({
  title,
  days,
  week,
  collapsed,
  canPrevious,
  canNext,
  emptyNote,
  onPrevious,
  onNext,
  onToggleCollapsed,
  onSelectDay,
}: {
  title: string;
  days: CalendarDay[];
  /** The focus day's own week, the one row the collapse keeps. */
  week: CalendarDay[];
  collapsed: boolean;
  canPrevious: boolean;
  canNext: boolean;
  /** Said inside the card when the month has nothing in it. */
  emptyNote: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onToggleCollapsed: () => void;
  onSelectDay: (key: string) => void;
}) {
  const shown = collapsed ? [week] : calendarRows(days);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <MonthStep back disabled={!canPrevious} onPress={onPrevious} />
        <Text style={styles.title}>{title}</Text>
        <MonthStep back={false} disabled={!canNext} onPress={onNext} />
        <Pressable
          onPress={onToggleCollapsed}
          style={styles.fold}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expand the calendar' : 'Collapse the calendar'}
        >
          {collapsed ? (
            <ChevronDown size={16} color={roles.textMuted} />
          ) : (
            <ChevronUp size={16} color={roles.textMuted} />
          )}
        </Pressable>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAY_CELLS.map(({ id, letter }) => (
          <Text key={id} style={styles.weekday}>
            {letter}
          </Text>
        ))}
      </View>

      {shown.map((row) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((cell) => (
            <DayCell key={cell.id} cell={cell} onSelect={onSelectDay} />
          ))}
        </View>
      ))}

      {emptyNote !== null && !collapsed && <Text style={styles.note}>{emptyNote}</Text>}
    </View>
  );
}

function MonthStep({
  back,
  disabled,
  onPress,
}: {
  back: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const color = disabled ? roles.textMuted : roles.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={disabled ? [styles.step, styles.stepOff] : styles.step}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={back ? 'Previous month' : 'Next month'}
    >
      {back ? <ChevronLeft size={17} color={color} /> : <ChevronRight size={17} color={color} />}
    </Pressable>
  );
}

function DayCell({
  cell,
  onSelect,
}: {
  cell: CalendarDay;
  onSelect: (key: string) => void;
}) {
  const key = cell.key;
  if (key === null) return <View style={styles.cell} />;

  const label = `${formatDayLabel(key)}${cell.trained ? ', trained' : ''}`;

  return (
    <Pressable
      onPress={() => onSelect(key)}
      disabled={cell.isFuture}
      style={cell.isToday ? [styles.cell, styles.cellToday] : styles.cell}
      accessibilityRole="button"
      accessibilityState={{ selected: cell.selected, disabled: cell.isFuture }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.fill,
          cell.trained && !cell.selected && styles.fillTrained,
          cell.selected && styles.fillSelected,
        ]}
      >
        <Text
          style={[
            styles.day,
            cell.isFuture && styles.dayFuture,
            cell.trained && !cell.selected && styles.dayTrained,
            cell.selected && styles.daySelected,
          ]}
        >
          {cell.day}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: roles.surfaceRaised,
    borderWidth: 1,
    borderColor: roles.border,
    borderRadius: radius.lg,
    paddingTop: spacing[2.5],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
  },
  title: {
    ...textStyles.label,
    fontSize: 15,
    fontWeight: '600',
    color: roles.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  step: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: {
    opacity: 0.4,
  },
  fold: {
    width: 26,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdays: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  weekday: {
    ...textStyles.captionSmall,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: roles.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  // The transparent border holds today's ring without resizing the cell, and
  // the card's own colour shows through as the gap between ring and fill.
  cell: {
    flex: 1,
    height: 31,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: roles.surfaceRaised,
  },
  cellToday: {
    borderColor: roles.accent,
    padding: 1.5,
  },
  fill: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillTrained: {
    backgroundColor: roles.accentSubtle,
  },
  fillSelected: {
    backgroundColor: roles.accent,
  },
  day: {
    ...textStyles.caption,
    fontSize: 13,
    fontWeight: '500',
    color: roles.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  dayFuture: {
    color: roles.textMuted,
  },
  dayTrained: {
    color: roles.accentText,
    fontWeight: '700',
  },
  daySelected: {
    color: roles.onAccent,
    fontWeight: '700',
  },
  note: {
    ...textStyles.caption,
    color: roles.textTertiary,
    textAlign: 'center',
    marginTop: spacing[2],
  },
});
