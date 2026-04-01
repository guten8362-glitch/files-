import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp, PrinterHealth } from "@/context/AppContext";

function PrinterCard({ printer }: { printer: PrinterHealth }) {
  const statusColor =
    printer.status === "Online" ? Colors.statusOnline :
      printer.status === "Offline" ? Colors.statusOffline : Colors.priorityMedium;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
      onPress={() => router.push({ pathname: "/printer/[id]", params: { id: printer.id } })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.printerIcon}>
          <Feather name="printer" size={20} color={Colors.primary} />
        </View>
        <View style={styles.printerInfo}>
          <Text style={styles.printerId}>{printer.printerId}</Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={10} color={Colors.textTertiary} />
            <Text style={styles.location}>{printer.location}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{printer.status}</Text>
        </View>
      </View>

      <View style={styles.modelRow}>
        <Feather name="cpu" size={11} color={Colors.textTertiary} />
        <Text style={styles.model}>{printer.model}</Text>
      </View>

      <View style={styles.levels}>
        <LevelMini label="Paper" value={printer.paperLevel} icon="file" />
        <View style={styles.levelDivider} />
        <LevelMini label="Tech" value={printer.assignedTechnicianName} icon="user" isText />
        <View style={styles.levelDivider} />
        <View style={styles.levelItem}>
          <Feather name="calendar" size={12} color={Colors.textTertiary} />
          <View>
            <Text style={styles.levelLabel}>Last Service</Text>
            <Text style={styles.levelValue}>
              {Math.floor((Date.now() - printer.lastServiced.getTime()) / (24 * 60 * 60 * 1000))}d ago
            </Text>
          </View>
        </View>
      </View>

      {printer.errorHistory.length > 0 && (
        <View style={styles.lastError}>
          <Feather name="alert-circle" size={11} color={Colors.textTertiary} />
          <Text style={styles.lastErrorText} numberOfLines={1}>
            Last: {printer.errorHistory[0].error}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function LevelMini({ label, value, icon, isText }: { label: string; value: string | number; icon: string; isText?: boolean }) {
  const color = typeof value === 'number' ? (value <= 20 ? Colors.priorityHigh : value <= 40 ? Colors.priorityMedium : Colors.priorityLow) : Colors.text;
  return (
    <View style={styles.levelItem}>
      <Feather name={icon as any} size={12} color={Colors.textTertiary} />
      <View>
        <Text style={styles.levelLabel}>{label}</Text>
        <Text style={[styles.levelValue, !isText && { color }]}>{isText ? value : `${value}%`}</Text>
      </View>
    </View>
  );
}

export default function PrintersScreen() {
  const { printers, addPrinter, currentUser, technicians } = useApp();
  const insets = useSafeAreaInsets();
  
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newPrinterData, setNewPrinterData] = useState({
    printerId: "", location: "", model: "", shopName: "", ownerName: "", ownerPhone: "", 
    maxPaperCapacity: "500", printedCount: "0", latitude: "12.9716", longitude: "77.5946", shopImage: "",
  });

  const filteredPrinters = currentUser?.role === "Senior Technician" 
    ? printers 
    : printers.filter(p => !p.assignedTechnicianId || p.assignedTechnicianId === currentUser?.id);

  const online = filteredPrinters.filter(p => p.status === "Online").length;
  const offline = filteredPrinters.filter(p => p.status === "Offline").length;
  const warning = filteredPrinters.filter(p => p.status === "Warning").length;

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewPrinterData({...newPrinterData, shopImage: result.assets[0].uri});
    }
  };

  const handleAddPrinter = () => {
    if (!newPrinterData.printerId.trim() || !newPrinterData.location.trim()) {
      Alert.alert("Missing Info", "Please fill in essential fields (Printer ID and Location).");
      return;
    }
    
    addPrinter({
      printerId: newPrinterData.printerId,
      location: newPrinterData.location,
      model: newPrinterData.model || "Unknown Model",
      building: "Main Campus",
      floor: "Location",
      shopName: newPrinterData.shopName || "Unnamed Shop",
      ownerName: newPrinterData.ownerName || "Unknown Owner",
      ownerPhone: newPrinterData.ownerPhone || "N/A",
      maxPaperCapacity: parseInt(newPrinterData.maxPaperCapacity) || 500,
      printedCount: parseInt(newPrinterData.printedCount) || 0,
      latitude: parseFloat(newPrinterData.latitude) || 12.0,
      longitude: parseFloat(newPrinterData.longitude) || 77.0,
      shopImage: newPrinterData.shopImage || "https://images.unsplash.com/photo-1560205001-a7fedfbfa4d7?auto=format&fit=crop&q=80&w=400",
      assignedTechnicianId: currentUser?.id || "t1",
      assignedTechnicianName: currentUser?.name || "Unassigned",
      inkLevel: 100,
    });
    
    setNewPrinterData({
      printerId: "", location: "", model: "", shopName: "", ownerName: "", ownerPhone: "", 
      maxPaperCapacity: "500", printedCount: "0", latitude: "12.9716", longitude: "77.5946", shopImage: "",
    });
    setIsAddModalVisible(false);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.headerArea, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.title}>Printer Health</Text>
            <Text style={styles.subtitle}>{filteredPrinters.length} printers monitored</Text>
          </View>
          <Pressable 
            style={styles.addPrinterBtn}
            onPress={() => setIsAddModalVisible(true)}
          >
            <Feather name="plus" size={16} color={Colors.white} />
            <Text style={styles.addPrinterBtnText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: Colors.priorityLowBg }]}>
            <View style={[styles.statDot, { backgroundColor: Colors.statusOnline }]} />
            <Text style={[styles.statNum, { color: Colors.statusOnline }]}>{online}</Text>
            <Text style={styles.statLbl}>Online</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: Colors.priorityHighBg }]}>
            <View style={[styles.statDot, { backgroundColor: Colors.statusOffline }]} />
            <Text style={[styles.statNum, { color: Colors.statusOffline }]}>{offline}</Text>
            <Text style={styles.statLbl}>Offline</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: Colors.priorityMediumBg }]}>
            <View style={[styles.statDot, { backgroundColor: Colors.priorityMedium }]} />
            <Text style={[styles.statNum, { color: Colors.priorityMedium }]}>{warning}</Text>
            <Text style={styles.statLbl}>Warning</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredPrinters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        renderItem={({ item }) => <PrinterCard printer={item} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Printer Modal */}
      <Modal visible={isAddModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Printer</Text>
              <Pressable onPress={() => setIsAddModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hardware Details</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Printer ID (e.g. PRN-999)" 
                  value={newPrinterData.printerId} 
                  onChangeText={txt => setNewPrinterData({...newPrinterData, printerId: txt})} 
                  placeholderTextColor={Colors.textTertiary}
                />
                <TextInput 
                  style={styles.input} 
                  placeholder="Model (e.g. HP LaserJet)" 
                  value={newPrinterData.model} 
                  onChangeText={txt => setNewPrinterData({...newPrinterData, model: txt})} 
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location & Shop Info</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Location (e.g. Lab 4)" 
                  value={newPrinterData.location} 
                  onChangeText={txt => setNewPrinterData({...newPrinterData, location: txt})} 
                  placeholderTextColor={Colors.textTertiary}
                />
                <TextInput style={styles.input} placeholder="Shop/Kiosk Name" value={newPrinterData.shopName} onChangeText={txt => setNewPrinterData({...newPrinterData, shopName: txt})} placeholderTextColor={Colors.textTertiary} />
                <TextInput style={styles.input} placeholder="Owner Name" value={newPrinterData.ownerName} onChangeText={txt => setNewPrinterData({...newPrinterData, ownerName: txt})} placeholderTextColor={Colors.textTertiary} />
                <TextInput style={styles.input} placeholder="Owner Phone" value={newPrinterData.ownerPhone} onChangeText={txt => setNewPrinterData({...newPrinterData, ownerPhone: txt})} placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" />
                
                <View style={[styles.formGroup, { marginTop: 4 }]}>
                  <Text style={styles.formLabel}>Shop Image</Text>
                  {newPrinterData.shopImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: newPrinterData.shopImage }} style={styles.imagePreview} />
                      <Pressable style={styles.changeImageBtn} onPress={pickImage}>
                        <Feather name="edit-2" size={14} color={Colors.white} />
                        <Text style={styles.changeImageText}>Change</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={styles.photoBtn} onPress={pickImage}>
                      <Feather name="image" size={20} color={Colors.primary} />
                      <Text style={styles.photoBtnText}>Upload Shop Photo</Text>
                    </Pressable>
                  )}
                </View>

              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.formGroup, {flex: 1}]}>
                  <Text style={styles.formLabel}>Max Capacity</Text>
                  <TextInput style={styles.input} value={newPrinterData.maxPaperCapacity} onChangeText={txt => setNewPrinterData({...newPrinterData, maxPaperCapacity: txt})} keyboardType="number-pad" />
                </View>
                <View style={[styles.formGroup, {flex: 1}]}>
                  <Text style={styles.formLabel}>Printed Count</Text>
                  <TextInput style={styles.input} value={newPrinterData.printedCount} onChangeText={txt => setNewPrinterData({...newPrinterData, printedCount: txt})} keyboardType="number-pad" />
                </View>
              </View>

              <Pressable style={styles.submitBtn} onPress={handleAddPrinter}>
                <Text style={styles.submitBtnText}>Add Printer</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    gap: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    marginBottom: 0,
  },
  addPrinterBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addPrinterBtnText: {
    color: Colors.white,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statNum: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  statLbl: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
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
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  printerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: "center",
    justifyContent: "center",
  },
  printerInfo: {
    flex: 1,
    gap: 3,
  },
  printerId: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  model: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  levels: {
    flexDirection: "row",
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  levelDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  levelItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  levelValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  lastError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lastErrorText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
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
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  modalScroll: {
    maxHeight: '80%',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  techChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  techChipActive: {
    backgroundColor: Colors.primaryUltraLight,
    borderColor: Colors.primary,
  },
  techChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  techChipTextActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    backgroundColor: Colors.background,
  },
  photoBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  imagePreviewContainer: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  changeImageBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  changeImageText: {
    color: Colors.white,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
