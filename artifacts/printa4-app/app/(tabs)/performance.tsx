import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, Technician } from "@/context/AppContext";

function RankBadge({ rank }: { rank: number }) {
  const colors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const bg = rank <= 3 ? colors[rank - 1] + "20" : Colors.background;
  const text = rank <= 3 ? colors[rank - 1] : Colors.textTertiary;
  return (
    <View style={[styles.rankBadge, { backgroundColor: bg }]}>
      <Text style={[styles.rankText, { color: text }]}>
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
      </Text>
    </View>
  );
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = Math.min(100, (value / max) * 100);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${width}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function PerformanceScreen() {
  const { technicians, tasks, currentUser } = useApp();
  const insets = useSafeAreaInsets();

  const ranked = [...technicians].sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  const myStats = technicians.find(t => t.email === currentUser?.email);
  const myRank = myStats ? ranked.findIndex(t => t.id === myStats.id) + 1 : null;
  const maxTasks = technicians.length > 0 ? Math.max(...technicians.map(t => t.tasksCompleted), 1) : 1;

  const totalCompleted = tasks.filter(t => t.status === "Completed").length;

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
      <Text style={styles.title}>Performance</Text>
      <Text style={styles.subtitle}>Team leaderboard & stats</Text>

      {myStats && (
        <View style={styles.myCard}>
          <View style={styles.myCardHeader}>
            <View style={styles.myAvatar}>
              <Text style={styles.myAvatarText}>{myStats.avatar}</Text>
            </View>
            <View style={styles.myInfo}>
              <Text style={styles.myName}>Your Stats</Text>
              <Text style={styles.myRole}>{currentUser?.role}</Text>
            </View>
            {myRank && <RankBadge rank={myRank} />}
          </View>

          <View style={styles.myStatsRow}>
            {[
              { label: "Completed", value: myStats.tasksCompleted.toString(), icon: "check-circle", color: Colors.priorityLow },
              { label: "Avg Response", value: `${myStats.avgResponseTime}m`, icon: "clock", color: Colors.primary },
              { label: "Success Rate", value: `${myStats.successRate}%`, icon: "award", color: Colors.accent },
            ].map((stat) => (
              <View key={stat.label} style={styles.myStat}>
                <View style={[styles.myStatIcon, { backgroundColor: stat.color + "15" }]}>
                  <Feather name={stat.icon as any} size={16} color={stat.color} />
                </View>
                <Text style={styles.myStatValue}>{stat.value}</Text>
                <Text style={styles.myStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: Colors.primaryUltraLight }]}>
          <Feather name="layers" size={20} color={Colors.primary} />
          <Text style={[styles.summaryValue, { color: Colors.primary }]}>{totalCompleted}</Text>
          <Text style={styles.summaryLabel}>Total Resolved</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: Colors.accentLight }]}>
          <Feather name="users" size={20} color={Colors.accent} />
          <Text style={[styles.summaryValue, { color: Colors.accent }]}>{technicians.filter(t => t.status !== "Offline").length}</Text>
          <Text style={styles.summaryLabel}>Active Staff</Text>
        </View>
      </View>

      <Text style={styles.leaderboardTitle}>Leaderboard</Text>

      <View style={styles.leaderboard}>
        {ranked.length > 0 ? ranked.map((tech, index) => (
          <View key={tech.id} style={[styles.leaderRow, index < ranked.length - 1 && styles.leaderRowBorder]}>
            <RankBadge rank={index + 1} />

            <View style={[styles.leaderAvatar, { backgroundColor: Colors.primaryUltraLight }]}>
              <Text style={styles.leaderAvatarText}>{tech.avatar}</Text>
            </View>

            <View style={styles.leaderContent}>
              <View style={styles.leaderNameRow}>
                <Text style={styles.leaderName}>{tech.name}</Text>
                <Text style={styles.leaderTaskCount}>{tech.tasksCompleted} tasks</Text>
              </View>
              <View style={styles.leaderStatsRow}>
                <Text style={styles.leaderStat}>{tech.avgResponseTime}m avg</Text>
                <Text style={styles.leaderStatDot}>·</Text>
                <Text style={styles.leaderStat}>{tech.successRate}% success</Text>
              </View>
              <StatBar value={tech.tasksCompleted} max={maxTasks} color={index === 0 ? "#FFD700" : index === 1 ? "#C0C0C0" : index === 2 ? "#CD7F32" : Colors.primary} />
            </View>
          </View>
        )) : (
          <View style={styles.emptyLeaderboard}>
            <Text style={styles.emptyLeaderboardText}>No rankings available yet.</Text>
          </View>
        )}
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
    marginTop: -16,
  },
  myCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  myCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  myAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: "center",
    justifyContent: "center",
  },
  myAvatarText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  myInfo: {
    flex: 1,
  },
  myName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  myRole: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  myStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  myStat: {
    alignItems: "center",
    gap: 6,
  },
  myStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  myStatValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  myStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  leaderboardTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  leaderboard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  leaderRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  leaderAvatarText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  leaderContent: {
    flex: 1,
    gap: 4,
  },
  leaderNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leaderName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  leaderTaskCount: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  leaderStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leaderStat: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  leaderStatDot: {
    color: Colors.textTertiary,
  },
  barTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },
  emptyLeaderboard: {
    padding: 40,
    alignItems: "center",
  },
  emptyLeaderboardText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
