import React, { useRef, useState, useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View, Animated, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Colors from "@/constants/colors";
import { PrinterTask, Technician } from "@/context/AppContext";
import { getPriorityColors } from "@/lib/priorityUtils";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";
import { LiveTimer } from "./LiveTimer";

interface Props {
  task: PrinterTask;
  onPress: () => void;
  onTakeTask?: (id: string) => Promise<void> | void;
  currentUserId?: string;
  currentUserEmail?: string;
  isSenior?: boolean;
  onReassign?: () => void;
  technicians?: Technician[];
}

const ISSUE_ICONS: Record<string, string> = {
  "No paper": "file-minus",
  "No Paper": "file-minus",
  "No toner ink": "droplet",
  "Jammed": "alert-circle",
  "Paper Jam": "alert-circle",
  "Door Opened": "unlock",
  "Printer Offline": "wifi-off",
  "Offline": "wifi-off",
  "Low paper": "file-text",
  "Low Paper": "file-text",
  "Service Requested": "headphones",
};

function formatTakenTime(takenAt: Date): string {
  const mins = Math.floor((Date.now() - takenAt.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

export function TaskCard({ task, onPress, onTakeTask, currentUserId, currentUserEmail, isSenior, onReassign, technicians = [] }: Props) {
  const isUnassigned = !task.assignedTechnicianId;
  const isMyTask = task.assignedTechnicianId === currentUserId || task.assignedTechnicianId === currentUserEmail;
  const isOverdue = task.takenAt ? (Date.now() - new Date(task.takenAt).getTime()) > 30 * 60 * 1000 : false;
  const [isTaking, setIsTaking] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);

  const resolveAssigneeName = (id: string | null): { name: string; initials: string } => {
    if (!id) return { name: 'Unknown', initials: '??' };
    const tech = technicians.find(t => t.id === id || t.email === id);
    if (tech) {
      const initials = tech.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      return { name: tech.name, initials };
    }
    return { name: id.split('@')[0], initials: id.slice(0, 2).toUpperCase() };
  };

  const handleTakeTask = async () => {
    if (!onTakeTask || isTaking) return;
    setIsTaking(true);
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await onTakeTask(task.id);
    } catch (err) { } finally {
      setIsTaking(false);
    }
  };

  const renderRightActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.shareAction}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Feather name="share-2" size={24} color={Colors.white} />
          <Text style={styles.shareText}>Share</Text>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') {
          swipeableRef.current?.close();
          onReassign?.();
        }
      }}
    >
      <Pressable
        style={({ pressed }) => [
          styles.card, 
          pressed && styles.cardPressed
        ]}
        onPress={onPress}
      >
        <View style={styles.header}>
          <View style={styles.printerInfo}>
            <View style={[styles.iconBox, { backgroundColor: getPriorityColors(task.priority).bg }]}>
              <Feather
                name={ISSUE_ICONS[task.issueType] as any || "printer"}
                size={16}
                color={getPriorityColors(task.priority).text}
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
            {!isUnassigned ? (() => {
              const { name, initials } = resolveAssigneeName(task.assignedTechnicianId);
              return (
                <View style={styles.assigneeContainer}>
                  <View style={[styles.avatar, isMyTask && styles.avatarMe]}>
                    <Text style={[styles.avatarText, isMyTask && styles.avatarTextMe]}>{initials}</Text>
                  </View>
                  <View style={styles.assigneeInfo}>
                    <Text style={[styles.techName, isMyTask && styles.techNameMe]} numberOfLines={1}>
                      {isMyTask ? 'You' : name}
                    </Text>
                    {task.takenAt && (
                      <Text style={styles.takenAtLabel}>since {formatTakenTime(new Date(task.takenAt))}</Text>
                    )}
                  </View>
                  {isMyTask && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>ON IT</Text>
                    </View>
                  )}
                </View>
              );
            })() : (
              <Pressable
                style={[styles.takeTaskBtn, isTaking && styles.takeTaskBtnLoading]}
                onPress={handleTakeTask}
                disabled={isTaking}
              >
                {isTaking ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Feather name="plus-circle" size={14} color={Colors.white} />
                )}
                <Text style={styles.takeTaskText}>{isTaking ? 'Taking...' : 'Take Task'}</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.footerRight}>
             <LiveTimer startTime={task.takenAt || task.createdAt} isUrgent={isOverdue} compact />
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
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
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  assigneeInfo: {
    flex: 1,
    gap: 1,
  },
  techName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    maxWidth: 120,
  },
  techNameMe: {
    color: '#16a34a',
    fontFamily: 'Inter_700Bold',
  },
  avatarMe: {
    backgroundColor: '#dcfce7',
  },
  avatarTextMe: {
    color: '#16a34a',
  },
  takenAtLabel: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  youBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  youBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: '#16a34a',
  },
  takeTaskBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  takeTaskBtnLoading: {
    opacity: 0.7,
  },
  takeTaskText: {
    color: Colors.white,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  shareAction: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginVertical: 1,
  },
  shareText: {
    color: Colors.white,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
});
