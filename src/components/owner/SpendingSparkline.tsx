import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

interface SpendingSparklineProps {
  // Oldest-first list of completed-visit totals in cents.
  points: number[];
  width?: number;
  height?: number;
}

// Phase 0.5 Spending Timeline: "a simple graph, not accounting software" —
// deliberately just a trend line, no axes/legends/tooltips.
export function SpendingSparkline({ points, width = 300, height = 80 }: SpendingSparklineProps) {
  if (points.length < 2) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>Not enough visits yet to show a trend</Text>
      </View>
    );
  }

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / range) * (height - 12) - 6;
    return { x, y };
  });

  const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ');
  const last = coords[coords.length - 1];
  const trendingUp = points[points.length - 1] >= points[0];

  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={height - 6} x2={width} y2={height - 6} stroke={Colors.border} strokeWidth={1} />
      <Polyline points={polylinePoints} fill="none" stroke={trendingUp ? Colors.success : Colors.warning} strokeWidth={2.5} />
      <Circle cx={last.x} cy={last.y} r={4} fill={trendingUp ? Colors.success : Colors.warning} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 12.5, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.lg },
});
