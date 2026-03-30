import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, PrinterHealth } from "@/context/AppContext";

function PrinterCard({ printer }: { printer: PrinterHealth }) {
  const statusColor =
    printer.status === "Online" ? Colors.statusOnline :
      printer.status === "Offline" ? Colors.statusOffline : Colors.priorityMedium;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
      onPress={() => router.push({ pathname: "/printer/[id]", params: { id: printer.id } })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.printerIcon}>
          <Feather name="printer" size={20} color={Colors.primary} />
        </View>
        <View style={styles.printerInfo}>
          <Text style={styles.printerId}>{printer.printerId}</Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={10} color={Colors.textTertiary} />
            <Text style={styles.location}>{printer.location}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{printer.status}</Text>
        </View>
      </View>

      <View style={styles.modelRow}>
        <Feather name="cpu" size={11} color={Colors.textTertiary} />
        <Text style={styles.model}>{printer.model}</Text>
      </View>

      <View style={styles.levels}>
        <LevelMini label="Ink" value={printer.inkLevel} icon="droplet" />
        <View style={styles.levelDivider} />
        <LevelMini label="Paper" value={printer.paperLevel} icon="file" />
        <View style={styles.levelDivider} />
        <View style={styles.levelItem}>
          <Feather name="calendar" size={12} color={Colors.textTertiary} />
          <View>
            <Text style={styles.levelLabel}>Last Service</Text>
            <Text style={styles.levelValue}>
              {Math.floor((Date.now() - printer.lastServiced.getTime()) / (24 * 60 * 60 * 1000))}d ago
            </Text>
          </View>
        </View>
      </View>

      {printer.errorHistory.length > 0 && (
        <View style={styles.lastError}>
          <Feather name="alert-circle" size={11} color={Colors.textTertiary} />
          <Text style={styles.lastErrorText} numberOfLines={1}>
            Last: {printer.errorHistory[0].error}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function LevelMini({ label, value, icon }: { label: string; value: number; icon: string }) {
  const color = value <= 20 ? Colors.priorityHigh : value <= 40 ? Colors.priorityMedium : Colors.priorityLow;
  return (
    <View style={styles.levelItem}>
      <Feather name={icon as any} size={12} color={color} />
      <View>
        <Text style={styles.levelLabel}>{label}</Text>
        <Text style={[styles.levelValue, { color }]}>{value}%</Text>
      </View>
    </View>
  );
}

export default function PrintersScreen() {
  const { printers } = useApp();
  const insets = useSafeAreaInsets();

  const online = printers.filter(p => p.status === "Online").length;
  const offline = printers.filter(p => p.status === "Offline").length;
  const warning = printers.filter(p => p.status === "Warning").length;

  return (
    <View style={styles.root}>
      <View style={[styles.headerArea, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <Text style={styles.title}>Printer Health</Text>
        <Text style={styles.subtitle}>{printers.length} printers monitored</Text>

        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: Colors.priorityLowBg }]}>
            <View style={[styles.statDot, { backgroundColor: Colors.statusOnline }]} />
            <Text style={[styles.statNum, { color: Colors.statusOnline }]}>{online}</Text>
            <Text style={styles.statLbl}>Online</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: Colors.priorityHighBg }]}>
            <View style={[styles.statDot, { backgroundColor: Colors.statusOffline }]} />
            <Text style={[styles.statNum, { color: Colors.statusOffline }]}>{offline}</Text>
            <Text style={styles.statLbl}>Offline</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: Colors.priorityMediumBg }]}>
            <View style={[styles.statDot, { backgroundColor: Colors.priorityMedium }]} />
            <Text style={[styles.statNum, { color: Colors.priorityMedium }]}>{warning}</Text>
            <Text style={styles.statLbl}>Warning</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={printers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        renderItem={({ item }) => <PrinterCard printer={item} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerArea: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statNum: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  statLbl: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  printerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: "center",
    justifyContent: "center",
  },
  printerInfo: {
    flex: 1,
    gap: 3,
  },
  printerId: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  model: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  levels: {
    flexDirection: "row",
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  levelDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  levelItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  levelValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  lastError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lastErrorText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    flex: 1,
  },
});
