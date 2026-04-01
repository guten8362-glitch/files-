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
import { useApp, TaskStatus } from "@/context/AppContext";
import { TaskCard } from "@/components/TaskCard";

export default function TasksScreen() {
  const { tasks, takeTask, currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const filtered = useMemo(() => {
    // Always exclude completed tasks
    let list = tasks.filter(t => t.status !== "Completed");

    // Regular Technicians: show unassigned tasks + tasks assigned to me
    // Senior Technicians: see all tasks
    if (currentUser?.role !== "Senior Technician") {
      list = list.filter(t =>
        !t.assignedTechnicianId || // unassigned — anyone can claim
        t.assignedTechnicianId === currentUser?.id // assigned to me
      );
    }

    return list;
  }, [tasks, currentUser]);

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
            isSenior={currentUser?.role === "Senior Technician"}
            isPrinterAssignedToMe={false}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={40} color={Colors.priorityLow} />
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptyText}>You have no pending tasks right now.</Text>
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
