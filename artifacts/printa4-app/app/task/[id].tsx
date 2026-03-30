import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, TaskStatus } from "@/context/AppContext";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { LiveTimer } from "@/components/LiveTimer";

const QUICK_FIX_ISSUES = ["Paper Jam", "Paper Empty", "Ink Low"];

const STATUS_FLOW: Record<TaskStatus, TaskStatus | null> = {
  Unassigned: "Assigned",
  Assigned: "On the way",
  "On the way": "Fixing",
  Fixing: "Completed",
  Completed: null,
};

const STATUS_ACTIONS: Record<TaskStatus, string> = {
  Unassigned: "Take Task",
  Assigned: "I'm On the Way",
  "On the way": "Start Fixing",
  Fixing: "Mark as Completed",
  Completed: "Completed",
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, currentUser, takeTask, updateTaskStatus, completeTask } = useApp();
  const insets = useSafeAreaInsets();

  const task = tasks.find(t => t.id === id);
  const [notes, setNotes] = useState(task?.notes || "");
  const [issueType, setIssueType] = useState(task?.issueType || "Paper Jam");
  const [activeTab, setActiveTab] = useState<"quick" | "detailed">("quick");

  if (!task) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Task not found</Text>
      </View>
    );
  }

  const isMyTask = task.assignedTechnicianId === currentUser?.id;
  const canAct = !task.assignedTechnicianId || isMyTask;
  const isQuickFix = QUICK_FIX_ISSUES.includes(task.issueType);
  const nextStatus = STATUS_FLOW[task.status];

  const handleAction = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    if (task.status === "Unassigned") {
      takeTask(task.id);
    } else if (task.status === "Fixing" || (nextStatus === "Completed")) {
      Alert.alert(
        "Complete Task",
        "Are you sure you want to mark this task as completed?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Complete", onPress: () => {
              completeTask(task.id, notes);
              router.back();
            },
          },
        ]
      );
    } else if (nextStatus) {
      updateTaskStatus(task.id, nextStatus);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Task Detail</Text>
        <Pressable style={styles.helpBtn} onPress={() => router.push("/assistance")}>
          <Feather name="phone-call" size={18} color={Colors.priorityHigh} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.taskCard}>
          <View style={styles.taskCardHeader}>
            <View>
              <Text style={styles.taskId}>{task.printerId}</Text>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={Colors.textTertiary} />
                <Text style={styles.location}>{task.location}</Text>
              </View>
            </View>
            <PriorityBadge priority={task.priority} />
          </View>

          {task.customerWaiting && (
            <View style={styles.waitingAlert}>
              <Feather name="user" size={14} color={Colors.priorityHigh} />
              <Text style={styles.waitingText}>Customer is waiting at this location</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <InfoRow icon="alert-circle" label="Issue" value={task.issueType} />
            <InfoRow icon="building" label="Building" value={task.building} />
            <InfoRow icon="layers" label="Floor" value={task.floor} />
          </View>

          <View style={styles.divider} />

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Text style={styles.statusLabel}>Status</Text>
              <StatusBadge status={task.status} />
            </View>
            <View style={styles.timerSection}>
              <Text style={styles.timerLabel}>
                {task.takenAt ? "Time since taken" : "Time since created"}
              </Text>
              <LiveTimer
                startTime={task.takenAt || task.createdAt}
                isUrgent={task.priority === "High"}
                showIcon
              />
            </View>
          </View>

          {task.assignedTechnicianName && (
            <View style={styles.techAssigned}>
              <View style={styles.techAvatar}>
                <Text style={styles.techAvatarText}>
                  {task.assignedTechnicianName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </Text>
              </View>
              <View>
                <Text style={styles.techLabel}>Assigned to</Text>
                <Text style={styles.techName}>
                  {isMyTask ? "You (" + task.assignedTechnicianName + ")" : task.assignedTechnicianName}
                </Text>
              </View>
            </View>
          )}
        </View>

        {task.status !== "Completed" && canAct && (task.status === "Fixing" || task.status === "Assigned" || task.status === "On the way") && (
          <View style={styles.fixSection}>
            <Text style={styles.fixTitle}>Fix Mode</Text>

            {isQuickFix && (
              <View style={styles.tabs}>
                <Pressable
                  style={[styles.tab, activeTab === "quick" && styles.tabActive]}
                  onPress={() => setActiveTab("quick")}
                >
                  <Feather name="zap" size={14} color={activeTab === "quick" ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.tabText, activeTab === "quick" && styles.tabTextActive]}>Quick Fix</Text>
                </Pressable>
                <Pressable
                  style={[styles.tab, activeTab === "detailed" && styles.tabActive]}
                  onPress={() => setActiveTab("detailed")}
                >
                  <Feather name="file-text" size={14} color={activeTab === "detailed" ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.tabText, activeTab === "detailed" && styles.tabTextActive]}>Detailed Report</Text>
                </Pressable>
              </View>
            )}

            {(!isQuickFix || activeTab === "detailed") && (
              <View style={styles.detailedForm}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Issue Type</Text>
                  <View style={styles.issueOptions}>
                    {(["Paper Jam", "Offline", "Ink Low", "Error Code", "Hardware Fault", "Connectivity Issue"] as const).map(issue => (
                      <Pressable
                        key={issue}
                        style={[styles.issueChip, issueType === issue && styles.issueChipActive]}
                        onPress={() => setIssueType(issue)}
                      >
                        <Text style={[styles.issueChipText, issueType === issue && styles.issueChipTextActive]}>
                          {issue}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Technician Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Describe the issue and steps taken..."
                    placeholderTextColor={Colors.textTertiary}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <Pressable style={styles.photoBtn}>
                  <Feather name="camera" size={16} color={Colors.primary} />
                  <Text style={styles.photoBtnText}>Add Photo Evidence</Text>
                </Pressable>
              </View>
            )}

            {isQuickFix && activeTab === "quick" && (
              <View style={styles.quickFixInfo}>
                <Feather name="zap" size={20} color={Colors.priorityLow} />
                <Text style={styles.quickFixText}>
                  Quick fix mode for {task.issueType}. Just resolve the issue and tap "Mark as Done".
                </Text>
              </View>
            )}
          </View>
        )}

        {task.status === "Completed" && (
          <View style={styles.completedCard}>
            <Feather name="check-circle" size={32} color={Colors.priorityLow} />
            <Text style={styles.completedTitle}>Task Completed</Text>
            {task.completedAt && (
              <Text style={styles.completedTime}>
                Resolved in {Math.floor((task.completedAt.getTime() - task.createdAt.getTime()) / 60000)} minutes
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {task.status !== "Completed" && canAct && nextStatus !== null && (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9 }]}
            onPress={handleAction}
          >
            <Feather
              name={task.status === "Unassigned" ? "check-circle" : task.status === "Fixing" ? "flag" : "arrow-right"}
              size={20}
              color={Colors.white}
            />
            <Text style={styles.actionBtnText}>{STATUS_ACTIONS[task.status]}</Text>
          </Pressable>

          {task.status !== "Unassigned" && (
            <Pressable
              style={styles.escalateBtn}
              onPress={() => router.push("/assistance")}
            >
              <Feather name="phone-call" size={18} color={Colors.priorityHigh} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon as any} size={14} color={Colors.primary} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
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
  helpBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.priorityHighBg,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  taskCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  taskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  taskId: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  location: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  waitingAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.priorityHighBg,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.priorityHigh,
  },
  waitingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.priorityHigh,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  infoGrid: {
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoIcon: {
    width: 20,
    textAlign: "center",
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    width: 70,
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLeft: {
    gap: 6,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  timerSection: {
    alignItems: "flex-end",
    gap: 4,
  },
  timerLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  techAssigned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.primaryUltraLight,
    padding: 12,
    borderRadius: 12,
  },
  techAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  techAvatarText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  techLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  techName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  fixSection: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  fixTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
  },
  quickFixInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.priorityLowBg,
    padding: 16,
    borderRadius: 12,
  },
  quickFixText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    flex: 1,
  },
  detailedForm: {
    gap: 16,
  },
  formField: {
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  issueOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  issueChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  issueChipActive: {
    backgroundColor: Colors.primaryUltraLight,
    borderColor: Colors.primary,
  },
  issueChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  issueChipTextActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  notesInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 14,
  },
  photoBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  completedCard: {
    backgroundColor: Colors.priorityLowBg,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  completedTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.priorityLow,
  },
  completedTime: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  actionBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  escalateBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.priorityHighBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.priorityHigh + "40",
  },
});
