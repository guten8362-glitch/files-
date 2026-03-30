import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { LevelBar } from "@/components/LevelBar";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function PrinterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { printers } = useApp();
  const insets = useSafeAreaInsets();

  const printer = printers.find(p => p.id === id);

  if (!printer) {
    return (
      <View style={styles.notFound}>
        <Text>Printer not found</Text>
      </View>
    );
  }

  const statusColor =
    printer.status === "Online" ? Colors.statusOnline :
      printer.status === "Offline" ? Colors.statusOffline : Colors.priorityMedium;

  const daysSinceService = Math.floor((Date.now() - printer.lastServiced.getTime()) / (24 * 60 * 60 * 1000));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Printer Health</Text>
        <View style={[styles.statusPill, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusPillText, { color: statusColor }]}>{printer.status}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.printerHero}>
          <View style={styles.printerIconLarge}>
            <Feather name="printer" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.printerId}>{printer.printerId}</Text>
          <Text style={styles.printerModel}>{printer.model}</Text>
          <View style={styles.locationChip}>
            <Feather name="map-pin" size={12} color={Colors.primary} />
            <Text style={styles.locationText}>{printer.location}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consumables</Text>
          <View style={styles.levelsCard}>
            <LevelBar label="Ink Level" value={printer.inkLevel} />
            <View style={styles.levelDivider} />
            <LevelBar label="Paper Level" value={printer.paperLevel} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Information</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon="calendar"
              label="Last Serviced"
              value={formatDate(printer.lastServiced)}
              valueColor={daysSinceService > 14 ? Colors.priorityMedium : Colors.text}
            />
            <View style={styles.infoDivider} />
            <InfoRow
              icon="clock"
              label="Days Since Service"
              value={`${daysSinceService} days ago`}
              valueColor={daysSinceService > 14 ? Colors.priorityHigh : Colors.priorityLow}
            />
            <View style={styles.infoDivider} />
            <InfoRow icon="building" label="Building" value={printer.building} />
            <View style={styles.infoDivider} />
            <InfoRow icon="layers" label="Floor" value={printer.floor} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Error History</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{printer.errorHistory.length}</Text>
            </View>
          </View>

          <View style={styles.errorList}>
            {printer.errorHistory.length === 0 ? (
              <View style={styles.noErrors}>
                <Feather name="check-circle" size={24} color={Colors.priorityLow} />
                <Text style={styles.noErrorsText}>No errors recorded</Text>
              </View>
            ) : (
              printer.errorHistory.map((entry, idx) => (
                <View key={idx} style={[styles.errorEntry, idx < printer.errorHistory.length - 1 && styles.errorEntryBorder]}>
                  <View style={styles.errorDot} />
                  <View style={styles.errorContent}>
                    <Text style={styles.errorDesc}>{entry.error}</Text>
                    <View style={styles.errorMeta}>
                      <View style={styles.errorMetaItem}>
                        <Feather name="calendar" size={10} color={Colors.textTertiary} />
                        <Text style={styles.errorMetaText}>{formatDate(entry.date)}</Text>
                      </View>
                      <View style={styles.errorMetaItem}>
                        <Feather name="clock" size={10} color={Colors.textTertiary} />
                        <Text style={styles.errorMetaText}>{formatTime(entry.date)}</Text>
                      </View>
                      {entry.resolvedBy ? (
                        <View style={styles.errorMetaItem}>
                          <Feather name="user" size={10} color={Colors.textTertiary} />
                          <Text style={styles.errorMetaText}>{entry.resolvedBy}</Text>
                        </View>
                      ) : (
                        <View style={[styles.pendingBadge]}>
                          <Text style={styles.pendingText}>Pending</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon as any} size={14} color={Colors.primary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  printerHero: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  printerIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  printerId: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  printerModel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primaryUltraLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  locationText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  countBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  levelsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  levelDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },
  errorList: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  errorEntry: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    alignItems: "flex-start",
  },
  errorEntryBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.priorityMedium,
    marginTop: 4,
  },
  errorContent: {
    flex: 1,
    gap: 6,
  },
  errorDesc: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  errorMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  errorMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  errorMetaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  pendingBadge: {
    backgroundColor: Colors.priorityMediumBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.priorityMedium,
  },
  noErrors: {
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  noErrorsText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
