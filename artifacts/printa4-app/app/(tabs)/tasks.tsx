import React, { useMemo, useState } from "react";
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
import { useApp, Priority, TaskStatus } from "@/context/AppContext";
import { TaskCard } from "@/components/TaskCard";

type FilterType = "All" | "Mine" | "Unassigned" | "High" | "Medium" | "Low";

export default function TasksScreen() {
  const { tasks, takeTask, currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterType>("All");

  const filtered = useMemo(() => {
    let list = tasks.filter(t => t.status !== "Completed");
    if (filter === "Mine") list = list.filter(t => t.assignedTechnicianId === currentUser?.id);
    else if (filter === "Unassigned") list = list.filter(t => !t.assignedTechnicianId);
    else if (filter === "High") list = list.filter(t => t.priority === "High");
    else if (filter === "Medium") list = list.filter(t => t.priority === "Medium");
    else if (filter === "Low") list = list.filter(t => t.priority === "Low");

    return list.sort((a, b) => {
      const priorityOrder: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [tasks, filter, currentUser]);

  const FILTERS: FilterType[] = ["All", "Mine", "Unassigned", "High", "Medium", "Low"];

  return (
    <View style={styles.root}>
      <View style={[styles.headerArea, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Tasks</Text>
            <Text style={styles.subtitle}>{filtered.length} active • {tasks.filter(t => !t.assignedTechnicianId).length} unassigned</Text>
          </View>
          <Pressable
            style={styles.assistBtn}
            onPress={() => router.push("/assistance")}
          >
            <Feather name="phone-call" size={16} color={Colors.priorityHigh} />
            <Text style={styles.assistBtnText}>Help</Text>
          </Pressable>
        </View>

        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={() => router.push({ pathname: "/task/[id]", params: { id: item.id } })}
            onTake={() => takeTask(item.id)}
            currentUserId={currentUser?.id}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={40} color={Colors.priorityLow} />
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptyText}>No active tasks for this filter.</Text>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
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
  },
  assistBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.priorityHighBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  assistBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.priorityHigh,
  },
  filterBar: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
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
  },
});
