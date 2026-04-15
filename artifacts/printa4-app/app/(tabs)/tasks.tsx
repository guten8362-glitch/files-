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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, TaskStatus, Technician } from "@/context/AppContext";
import { TaskCard } from "@/components/TaskCard";



export default function TasksScreen() {
  const { tasks, takeTask, currentUser, logout, technicians, refreshData, isLoading } = useApp();
  const insets = useSafeAreaInsets();
  
  const [reassignTaskId, setReassignTaskId] = useState<string | null>(null);
  const [isReassignModalVisible, setIsReassignModalVisible] = useState(false);

  const filtered = useMemo(() => {
    // Always exclude completed tasks
    let list = tasks.filter(t => t.status !== "Completed");

    // Regular Technicians: show unassigned tasks + tasks assigned to me
    if (currentUser?.role !== "Senior Technician") {
      list = list.filter(t =>
        !t.assignedTechnicianId || 
        t.assignedTechnicianId === currentUser?.id ||
        t.assignedTechnicianId === currentUser?.email // email check as fallback
      );
    }
    return list;
  }, [tasks, currentUser]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const openReassign = (taskId: string) => {
    setReassignTaskId(taskId);
    setIsReassignModalVisible(true);
  };

  const handleReassign = async (techId: string) => {
    setReassignTaskId(null);
    setIsReassignModalVisible(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refreshData();
  };

  if (isLoading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.subtitle}>Refreshing tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.headerArea, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>SupportA4</Text>
            <Text style={styles.subtitle}>{filtered.length} active • {tasks.filter(t => !t.assignedTechnicianId).length} unassigned</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.assistBtn}
              onPress={() => router.push("/assistance")}
            >
              <Feather name="help-circle" size={16} color={Colors.primary} />
              <Text style={[styles.assistBtnText, { color: Colors.primary }]}>Help</Text>
            </Pressable>
            <Pressable
              style={styles.logoutBtn}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        renderItem={({ item, index }) => (
          <TaskCard
            task={item}
            onPress={() => router.push({ pathname: "/task/[id]", params: { id: item.id } })}
            onTakeTask={(id) => takeTask(id)}
            currentUserId={currentUser?.id}
            currentUserEmail={currentUser?.email}
            isSenior={currentUser?.role === "Senior Technician"}
            isPrinterAssignedToMe={false}
            onReassign={() => openReassign(item.id)}
            technicians={technicians}
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




      {/* Reassign Modal */}
      {isReassignModalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.reassignModal]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Share Task</Text>
                <Pressable onPress={() => setIsReassignModalVisible(false)} style={styles.closeBtn}>
                  <Feather name="x" size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.modalSub}>Select a technician to receive this task.</Text>
              
              <View style={styles.techList}>
                {technicians.filter(t => t.id !== currentUser?.id).map(tech => (
                  <Pressable key={tech.id} style={styles.techRow} onPress={() => handleReassign(tech.id)}>
                    <View style={[styles.techAvatar, { backgroundColor: Colors.primaryUltraLight }]}>
                      <Text style={styles.techAvatarText}>{tech.avatar}</Text>
                    </View>
                    <View style={styles.techInfo}>
                      <Text style={styles.techName}>{tech.name}</Text>
                      <Text style={styles.techStatus}>{tech.status}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}
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
  aiContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  aiBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: '#f3e8ff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  resetAiBtn: {
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetAiText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  aiBtnActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  aiBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: '#8b5cf6',
  },
  aiBtnTextActive: {
    color: Colors.white,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
  },
  wideModal: {
    paddingBottom: 32,
  },
  reassignModal: {
    maxHeight: '80%',
    width: '100%',
  },
  strategyList: {
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  strategyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  strategyCardActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  strategyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strategyContent: {
    flex: 1,
    gap: 2,
  },
  strategyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  strategyTitleActive: {
    color: Colors.white,
  },
  strategyDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  strategyDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  specialistForm: {
    marginTop: 8,
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: Colors.background,
    borderRadius: 20,
  },
  modalSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 16,
  },
  aiInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    marginBottom: 12,
  },
  aiChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  aiChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primaryUltraLight,
  },
  aiChipText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  aiSubmitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  aiSubmitBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  techList: {
    gap: 8,
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 12,
  },
  techAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  techAvatarText: {
    color: Colors.primary,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  techInfo: {
    flex: 1,
    gap: 2,
  },
  techName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  techStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
