import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

interface Props {
  label: string;
  value: number;
  unit?: string;
  icon?: string;
}

function getColor(value: number): string {
  if (value <= 20) return Colors.priorityHigh;
  if (value <= 40) return Colors.priorityMedium;
  return Colors.priorityLow;
}

export function LevelBar({ label, value, unit = "%" }: Props) {
  const color = getColor(value);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>{value}{unit}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.max(2, value)}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.status, { color }]}>
        {value <= 20 ? "Critical" : value <= 40 ? "Low" : value <= 60 ? "Moderate" : "Good"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  value: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  track: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  status: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
