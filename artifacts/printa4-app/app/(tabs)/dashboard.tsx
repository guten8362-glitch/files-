import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

export default function DashboardScreen() {
  const { tasks, technicians, currentUser, logout } = useApp();
  const insets = useSafeAreaInsets();

  const total = tasks.filter(t => t.status !== "Completed").length;
  const high = tasks.filter(t => t.priority === "High" && t.status !== "Completed").length;
  const medium = tasks.filter(t => t.priority === "Medium" && t.status !== "Completed").length;
  const low = tasks.filter(t => t.priority === "Low" && t.status !== "Completed").length;
  const unassigned = tasks.filter(t => !t.assignedTechnicianId).length;
  const myTasks = tasks.filter(t => t.assignedTechnicianId === currentUser?.id && t.status !== "Completed").length;
  const available = technicians.filter(t => t.status === "Available").length;

  const handleLogout = async () => {
    logout();
    router.replace("/login");
  };

  const recentActivity = tasks.slice(0, 3);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.name}>{currentUser?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.role}>{currentUser?.role} · IT Maintenance</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Tasks</Text>
        <Pressable onPress={() => router.push("/(tabs)/tasks")}>
          <Text style={styles.seeAll}>See code</Text>
        </Pressable>
      </View>

      <View style={styles.activityList}>
        {recentActivity.map((task) => (
          <Pressable
            key={task.id}
            style={({ pressed }) => [styles.activityItem, pressed && { opacity: 0.8 }]}
            onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id } })}
          >
            <View style={[
              styles.activityDot,
              {
                backgroundColor:
                  task.priority === "High" ? Colors.priorityHigh :
                    task.priority === "Medium" ? Colors.priorityMedium : Colors.priorityLow,
              },
            ]} />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{task.printerId} — {task.issueType}</Text>
              <Text style={styles.activitySub}>{task.location} · {task.status}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Performance Overview</Text>

      <View style={styles.statsGrid}>
        <Pressable style={[styles.statCard, styles.statCardPrimary]} onPress={() => router.push("/(tabs)/tasks")}>
          <View style={styles.statIconBox}>
            <Feather name="layers" size={20} color={Colors.white} />
          </View>
          <Text style={styles.statValueWhite}>{total}</Text>
          <Text style={styles.statLabelWhite}>Active Tasks</Text>
          <View style={styles.statArrow}>
            <Feather name="arrow-right" size={14} color={Colors.white} />
          </View>
        </Pressable>

        <Pressable style={[styles.statCard, styles.statCardHigh]} onPress={() => router.push("/(tabs)/tasks")}>
          <View style={[styles.statIconBox, { backgroundColor: Colors.priorityHigh }]}>
            <Feather name="alert-circle" size={20} color={Colors.white} />
          </View>
          <Text style={[styles.statValue, { color: Colors.priorityHigh }]}>{high}</Text>
          <Text style={styles.statLabel}>Critical</Text>
        </Pressable>

        <Pressable style={[styles.statCard, styles.statCardMedium]} onPress={() => router.push("/(tabs)/tasks")}>
          <View style={[styles.statIconBox, { backgroundColor: Colors.priorityMedium }]}>
            <Feather name="clock" size={20} color={Colors.white} />
          </View>
          <Text style={[styles.statValue, { color: Colors.priorityMedium }]}>{medium}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </Pressable>

        <Pressable style={[styles.statCard, styles.statCardLow]} onPress={() => router.push("/(tabs)/tasks")}>
          <View style={[styles.statIconBox, { backgroundColor: Colors.priorityLow }]}>
            <Feather name="check-circle" size={20} color={Colors.white} />
          </View>
          <Text style={[styles.statValue, { color: Colors.priorityLow }]}>{low}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </Pressable>
      </View>

      <View style={styles.databaseSection}>
        <View style={styles.databaseHeader}>
          <Feather name="database" size={16} color={Colors.primary} />
          <Text style={styles.databaseTitle}>Appwrite Backend</Text>
        </View>
        <View style={styles.databasePlaceholder}>
          <Text style={styles.databaseText}>Connected to Appwrite Cluster</Text>
          <Text style={styles.databaseSub}>Waiting for live data sync...</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {[
          { icon: "list", label: "All Tasks", route: "/(tabs)/tasks", color: Colors.primary },
          { icon: "printer", label: "Printers", route: "/(tabs)/printers", color: Colors.accent },
          { icon: "users", label: "Technicians", route: "/(tabs)/technicians", color: "#FF9500" },
          { icon: "bar-chart-2", label: "Performance", route: "/(tabs)/performance", color: Colors.statusAvailable },
        ].map((action) => (
          <Pressable
            key={action.label}
            style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(action.route as any)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: action.color + "15" }]}>
              <Feather name={action.icon as any} size={22} color={action.color} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>


    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  name: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  role: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.priorityHighBg,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.priorityHigh,
  },
  alertText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.priorityHigh,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: "relative",
  },
  statCardPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statCardHigh: {
    borderColor: Colors.priorityHighBg,
    backgroundColor: Colors.priorityHighBg,
  },
  statCardMedium: {
    borderColor: Colors.priorityMediumBg,
    backgroundColor: Colors.priorityMediumBg,
  },
  statCardLow: {
    borderColor: Colors.priorityLowBg,
    backgroundColor: Colors.priorityLowBg,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  statValueWhite: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  statLabelWhite: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
  },
  statArrow: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickStats: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quickStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  quickStatValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  quickStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  activityList: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityContent: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  activitySub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  databaseSection: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: "dashed",
    gap: 12,
  },
  databaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  databaseTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  databasePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: Colors.background,
    borderRadius: 12,
    gap: 4,
  },
  databaseText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  databaseSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});
