import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { PrinterTask } from "@/context/AppContext";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";
import { LiveTimer } from "./LiveTimer";

interface Props {
  task: PrinterTask;
  onPress: () => void;
  onTake?: () => void;
  currentUserId?: string;
}

const ISSUE_ICONS: Record<string, string> = {
  "Paper Jam": "alert-circle",
  "Offline": "wifi-off",
  "Ink Low": "droplet",
  "Paper Empty": "file-minus",
  "Error Code": "x-circle",
  "Connectivity Issue": "wifi",
  "Hardware Fault": "tool",
  "Maintenance Due": "settings",
};

export function TaskCard({ task, onPress, onTake, currentUserId }: Props) {
  const isUnassigned = !task.assignedTechnicianId;
  const isMyTask = task.assignedTechnicianId === currentUserId;
  const isOverdue = task.takenAt ? (Date.now() - task.takenAt.getTime()) > 30 * 60 * 1000 : false;

  const handleTake = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onTake?.();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {task.customerWaiting && (
        <View style={styles.waitingBanner}>
          <Feather name="user" size={10} color={Colors.white} />
          <Text style={styles.waitingText}>Customer Waiting</Text>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.printerInfo}>
          <View style={[styles.iconBox, { backgroundColor: task.priority === "High" ? Colors.priorityHighBg : task.priority === "Medium" ? Colors.priorityMediumBg : Colors.priorityLowBg }]}>
            <Feather
              name={ISSUE_ICONS[task.issueType] as any || "printer"}
              size={16}
              color={task.priority === "High" ? Colors.priorityHigh : task.priority === "Medium" ? Colors.priorityMedium : Colors.priorityLow}
            />
          </View>
          <View>
            <Text style={styles.printerId}>{task.printerId}</Text>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={10} color={Colors.textTertiary} />
              <Text style={styles.location}>{task.location}</Text>
            </View>
          </View>
        </View>
        <PriorityBadge priority={task.priority} size="sm" />
      </View>

      <View style={styles.issueRow}>
        <Text style={styles.issueType}>{task.issueType}</Text>
        <StatusBadge status={task.status} />
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {task.assignedTechnicianName ? (
            <View style={styles.techRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {task.assignedTechnicianName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </Text>
              </View>
              <Text style={styles.techName} numberOfLines={1}>{isMyTask ? "You" : task.assignedTechnicianName}</Text>
            </View>
          ) : (
            <Text style={styles.unassignedText}>Unassigned</Text>
          )}
        </View>

        <View style={styles.footerRight}>
          {task.takenAt ? (
            <LiveTimer startTime={task.takenAt} isUrgent={isOverdue} compact />
          ) : (
            <LiveTimer startTime={task.createdAt} compact />
          )}
        </View>
      </View>

      {isUnassigned && onTake && (
        <Pressable style={styles.takeBtn} onPress={handleTake}>
          <Feather name="check-circle" size={14} color={Colors.white} />
          <Text style={styles.takeBtnText}>Take Task</Text>
        </Pressable>
      )}

      {!isUnassigned && isMyTask && isOverdue && (
        <View style={styles.takeoverRow}>
          <Feather name="alert-triangle" size={12} color={Colors.priorityHigh} />
          <Text style={styles.takeoverText}>Task delayed — consider escalation</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.priorityHigh,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: -4,
  },
  waitingText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  printerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  printerId: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  location: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: "Inter_400Regular",
  },
  issueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  issueType: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    alignItems: "flex-end",
  },
  techRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  techName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    maxWidth: 120,
  },
  unassignedText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  takeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  takeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  takeoverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.priorityHighBg,
    padding: 8,
    borderRadius: 8,
  },
  takeoverText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.priorityHigh,
  },
});
