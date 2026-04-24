import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getPriorityColors, getPriorityLabel } from "@/lib/priorityUtils";

interface Props {
  /** Numeric priority rank 1-7. Lower = more urgent. */
  priority: number;
  size?: "sm" | "md";
}

export function PriorityBadge({ priority, size = "md" }: Props) {
  const colors = getPriorityColors(priority);
  const label = getPriorityLabel(priority);
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg, borderColor: colors.border },
        isSmall && styles.badgeSm,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.dot }, isSmall && styles.dotSm]} />
      <Text style={[styles.text, { color: colors.text }, isSmall && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSm: {
    width: 5,
    height: 5,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  textSm: {
    fontSize: 11,
  },
});
