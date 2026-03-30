import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { Priority } from "@/context/AppContext";

interface Props {
  priority: Priority;
  size?: "sm" | "md";
}

export function PriorityBadge({ priority, size = "md" }: Props) {
  const config = {
    High: { bg: Colors.priorityHighBg, text: Colors.priorityHigh, dot: Colors.priorityHigh },
    Medium: { bg: Colors.priorityMediumBg, text: Colors.priorityMedium, dot: Colors.priorityMedium },
    Low: { bg: Colors.priorityLowBg, text: Colors.priorityLow, dot: Colors.priorityLow },
  }[priority];

  const isSmall = size === "sm";

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSmall && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: config.dot }, isSmall && styles.dotSm]} />
      <Text style={[styles.text, { color: config.text }, isSmall && styles.textSm]}>{priority}</Text>
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
