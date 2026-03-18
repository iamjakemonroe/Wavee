import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { colors } from "@/theme/colors";

export default function ProfileScreen() {
  const profile = useAuthStore((state) => state.profile);

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.username}>{profile?.username ?? "Unknown artist"}</Text>
        <Text style={styles.meta}>{profile?.email}</Text>
        <Text style={styles.meta}>{profile?.bio ?? "No bio yet"}</Text>
      </View>

      <View style={styles.analytics}>
        <Text style={styles.sectionTitle}>Creator dashboard</Text>
        <Text style={styles.metric}>plays: placeholder</Text>
        <Text style={styles.metric}>likes: placeholder</Text>
        <Text style={styles.metric}>completion rate: placeholder</Text>
      </View>

      <Pressable style={styles.signOut} onPress={() => authService.signOut()}>
        <Text style={styles.signOutLabel}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
  },
  username: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  meta: { color: colors.textSecondary, marginTop: 6 },
  analytics: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
  },
  sectionTitle: { color: colors.textPrimary, fontWeight: "700", marginBottom: 6 },
  metric: { color: colors.textSecondary, marginBottom: 4 },
  signOut: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  signOutLabel: { color: colors.textPrimary, fontWeight: "700" },
});
