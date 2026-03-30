import React, { useState } from "react";
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
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const SENIOR_TECHNICIANS = [
  {
    id: "s1",
    name: "Prof. Rajesh Menon",
    title: "Head of IT Maintenance",
    phone: "+91 99887 76655",
    avatar: "RM",
    status: "Available" as const,
    expertise: "Hardware, Network, Advanced Diagnostics",
    responseTime: "< 5 min",
  },
  {
    id: "s2",
    name: "Mrs. Kavitha Suresh",
    title: "Senior Systems Engineer",
    phone: "+91 88776 65544",
    avatar: "KS",
    status: "Busy" as const,
    expertise: "Printer Maintenance, Software Issues",
    responseTime: "10-15 min",
  },
];

export default function AssistanceScreen() {
  const insets = useSafeAreaInsets();
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  const handleRequest = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setRequested(prev => ({ ...prev, [id]: true }));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Request Assistance</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 40) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.urgencyCard}>
          <View style={styles.urgencyIconRow}>
            <View style={styles.urgencyIconOuter}>
              <Feather name="phone-call" size={28} color={Colors.white} />
            </View>
          </View>
          <Text style={styles.urgencyTitle}>Need Help?</Text>
          <Text style={styles.urgencyText}>
            Contact a senior technician for complex issues, escalations, or emergency support.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Senior Technicians</Text>

          {SENIOR_TECHNICIANS.map((tech) => (
            <View key={tech.id} style={styles.techCard}>
              <View style={styles.techHeader}>
                <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
                  <Text style={styles.avatarText}>{tech.avatar}</Text>
                </View>
                <View style={styles.techInfo}>
                  <Text style={styles.techName}>{tech.name}</Text>
                  <Text style={styles.techTitle}>{tech.title}</Text>
                </View>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: tech.status === "Available" ? Colors.statusAvailable : Colors.priorityMedium }
                ]} />
              </View>

              <View style={styles.expertiseRow}>
                <Feather name="star" size={12} color={Colors.accent} />
                <Text style={styles.expertiseText}>{tech.expertise}</Text>
              </View>

              <View style={styles.techMeta}>
                <View style={styles.metaItem}>
                  <Feather name="phone" size={12} color={Colors.primary} />
                  <Text style={styles.metaText}>{tech.phone}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="clock" size={12} color={Colors.primary} />
                  <Text style={styles.metaText}>Response: {tech.responseTime}</Text>
                </View>
                <View style={[
                  styles.availabilityBadge,
                  { backgroundColor: tech.status === "Available" ? Colors.priorityLowBg : Colors.priorityMediumBg }
                ]}>
                  <Text style={[
                    styles.availabilityText,
                    { color: tech.status === "Available" ? Colors.statusAvailable : Colors.priorityMedium }
                  ]}>
                    {tech.status}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                {requested[tech.id] ? (
                  <View style={styles.requestedBtn}>
                    <Feather name="check" size={16} color={Colors.priorityLow} />
                    <Text style={styles.requestedBtnText}>Assistance Requested</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.requestBtn, pressed && { opacity: 0.9 }]}
                    onPress={() => handleRequest(tech.id)}
                  >
                    <Feather name="phone-call" size={16} color={Colors.white} />
                    <Text style={styles.requestBtnText}>Request Assistance</Text>
                  </Pressable>
                )}

                <Pressable style={styles.callBtn}>
                  <Feather name="phone" size={18} color={Colors.primary} />
                </Pressable>
              </View>

              {requested[tech.id] && (
                <View style={styles.sentAlert}>
                  <Feather name="check-circle" size={14} color={Colors.priorityLow} />
                  <Text style={styles.sentAlertText}>
                    {tech.name} has been notified. They will be {tech.status === "Available" ? "on the way shortly" : "with you after their current task"}.
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.guidelinesCard}>
          <Text style={styles.guidelinesTitle}>When to Escalate</Text>
          <View style={styles.guidelinesList}>
            {[
              "Task has been pending for over 30 minutes",
              "Hardware replacement required",
              "Network or software configuration issues",
              "Customer is repeatedly waiting",
              "Cannot identify the root cause",
            ].map((item, idx) => (
              <View key={idx} style={styles.guidelineItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.guidelineText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.priorityHigh,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  urgencyCard: {
    backgroundColor: Colors.priorityHigh,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  urgencyIconRow: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  urgencyIconOuter: {
    alignItems: "center",
    justifyContent: "center",
  },
  urgencyTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  urgencyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  techCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  techHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  techInfo: {
    flex: 1,
    gap: 3,
  },
  techName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  techTitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  expertiseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  expertiseText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
    flex: 1,
  },
  techMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  availabilityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  requestBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.priorityHigh,
    height: 46,
    borderRadius: 12,
    shadowColor: Colors.priorityHigh,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  requestBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  requestedBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.priorityLowBg,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.priorityLow,
  },
  requestedBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.priorityLow,
  },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sentAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.priorityLowBg,
    padding: 12,
    borderRadius: 10,
  },
  sentAlertText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    flex: 1,
  },
  guidelinesCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  guidelinesTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  guidelinesList: {
    gap: 10,
  },
  guidelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 5,
  },
  guidelineText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    flex: 1,
  },
});
