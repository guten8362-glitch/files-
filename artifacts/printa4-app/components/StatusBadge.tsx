import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { TaskStatus } from "@/context/AppContext";

interface Props {
  status: TaskStatus;
}

const STATUS_CONFIG: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  Unassigned: { bg: "#F5F5F5", text: "#8A8A8A", label: "Unassigned" },
  Assigned: { bg: Colors.primaryUltraLight, text: Colors.primary, label: "Assigned" },
  "On the way": { bg: Colors.accentLight, text: Colors.accent, label: "On the way" },
  Fixing: { bg: Colors.priorityMediumBg, text: Colors.priorityMedium, label: "Fixing" },
  Completed: { bg: Colors.priorityLowBg, text: Colors.priorityLow, label: "Completed" },
};

export function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
