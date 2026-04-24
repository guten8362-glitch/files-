import { Redirect } from "expo-router";
import { useApp } from "@/context/AppContext";
import { View, ActivityIndicator, StyleSheet, Text, Pressable } from "react-native";
import Colors from "@/constants/colors";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

export default function IndexRedirect() {
  const { isLoggedIn } = useApp();

  if (isLoggedIn) {
    return <Redirect href="/(tabs)/tasks" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SupportA4</Text>
      <Pressable style={styles.iconBtn} onPress={() => router.push("/help")}>
        <Feather name="help-circle" size={20} color={Colors.textSecondary} />
      </Pressable>
      <Redirect href="/login" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  iconBtn: {
    padding: 10,
  },
});
