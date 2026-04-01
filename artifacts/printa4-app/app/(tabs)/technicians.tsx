import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, Technician, TechnicianStatus } from "@/context/AppContext";

const STATUS_COLORS: Record<TechnicianStatus, { bg: string; text: string; dot: string }> = {
  Available: { bg: Colors.priorityLowBg, text: Colors.statusAvailable, dot: Colors.statusAvailable },
  Busy: { bg: Colors.priorityMediumBg, text: Colors.priorityMedium, dot: Colors.priorityMedium },
  Offline: { bg: "#F5F5F5", text: "#8A8A8A", dot: "#C0C0C0" },
};

function TechCard({ tech, taskCount }: { tech: Technician; taskCount: number }) {
  const sc = STATUS_COLORS[tech.status];
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, { backgroundColor: Colors.primaryUltraLight }]}>
          <Text style={styles.avatarText}>{tech.avatar}</Text>
        </View>
        {tech.status === "Available" && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{tech.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
            <Text style={[styles.statusText, { color: sc.text }]}>{tech.status}</Text>
          </View>
        </View>

        <Pressable style={styles.emailRow} onPress={() => Linking.openURL(`mailto:${tech.email}`)}>
          <Feather name="mail" size={11} color={Colors.textTertiary} />
          <Text style={styles.email}>{tech.email}</Text>
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.miniStat}>
            <Feather name="check-circle" size={12} color={Colors.primaryLight} />
            <Text style={styles.miniStatText}>{tech.tasksCompleted} done</Text>
          </View>
          <View style={styles.miniStat}>
            <Feather name="clock" size={12} color={Colors.primaryLight} />
            <Text style={styles.miniStatText}>{tech.avgResponseTime}m avg</Text>
          </View>
          <View style={styles.miniStat}>
            <Feather name="award" size={12} color={Colors.primaryLight} />
            <Text style={styles.miniStatText}>{tech.successRate}%</Text>
          </View>
        </View>

        {taskCount > 0 && (
          <View style={styles.activeTaskRow}>
            <Feather name="activity" size={11} color={Colors.priorityMedium} />
            <Text style={styles.activeTaskText}>{taskCount} active task{taskCount > 1 ? "s" : ""}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardRight}>
        <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${tech.phone}`)}>
          <Feather name="phone" size={14} color={Colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TechniciansScreen() {
  const { technicians, tasks } = useApp();
  const insets = useSafeAreaInsets();

  const getTaskCount = (techId: string) =>
    tasks.filter(t => t.assignedTechnicianId === techId && t.status !== "Completed").length;

  const sorted = [...technicians].sort((a, b) => {
    const order: Record<TechnicianStatus, number> = { Available: 0, Busy: 1, Offline: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <View style={styles.root}>
      <View style={[styles.headerArea, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <Text style={styles.title}>Technicians</Text>
        <Text style={styles.subtitle}>{technicians.length} staff members</Text>

        <View style={styles.statusSummary}>
          {(["Available", "Busy", "Offline"] as TechnicianStatus[]).map((s) => {
            const count = technicians.filter(t => t.status === s).length;
            const sc = STATUS_COLORS[s];
            return (
              <View key={s} style={[styles.summaryItem, { backgroundColor: sc.bg }]}>
                <View style={[styles.summaryDot, { backgroundColor: sc.dot }]} />
                <Text style={[styles.summaryCount, { color: sc.text }]}>{count}</Text>
                <Text style={[styles.summaryLabel, { color: sc.text }]}>{s}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        renderItem={({ item }) => (
          <TechCard tech={item} taskCount={getTaskCount(item.id)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No staff members</Text>
            <Text style={styles.emptyText}>There are no technicians in the database yet.</Text>
          </View>
        }
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
  statusSummary: {
    flexDirection: "row",
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  summaryCount: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
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
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.statusAvailable,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  email: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  miniStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  miniStatText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  activeTaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.priorityMediumBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  activeTaskText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.priorityMedium,
  },
  cardRight: {},
  callBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
