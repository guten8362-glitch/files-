import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Feather } from "@expo/vector-icons";

export function TaskMap({ latitude, longitude }: any) {
  return (
    <View style={styles.infoRow}>
      <Feather name="map-pin" size={14} color="#3b82f6" style={styles.infoIcon} />
      <Text style={styles.infoLabel}>Coords</Text>
      <Text style={styles.infoValue}>{latitude}, {longitude}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  infoIcon: {
    width: 20,
    textAlign: "center",
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6b7280",
    width: 70,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
    flex: 1,
  },
});
