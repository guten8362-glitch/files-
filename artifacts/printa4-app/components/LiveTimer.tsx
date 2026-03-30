import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface Props {
  startTime: Date;
  isUrgent?: boolean;
  showIcon?: boolean;
  compact?: boolean;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function LiveTimer({ startTime, isUrgent = false, showIcon = true, compact = false }: Props) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime.getTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const isOverdue = elapsed > 30 * 60 * 1000;
  const color = isOverdue || isUrgent ? Colors.priorityHigh : Colors.textSecondary;

  return (
    <View style={styles.container}>
      {showIcon && (
        <Feather name="clock" size={compact ? 11 : 12} color={color} />
      )}
      <Text style={[styles.text, { color }, compact && styles.compact, isOverdue && styles.overdue]}>
        {formatDuration(elapsed)}
      </Text>
      {isOverdue && !compact && (
        <Text style={styles.overdueLabel}>DELAYED</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  compact: {
    fontSize: 11,
  },
  overdue: {
    color: Colors.priorityHigh,
  },
  overdueLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.priorityHigh,
    backgroundColor: Colors.priorityHighBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
});
