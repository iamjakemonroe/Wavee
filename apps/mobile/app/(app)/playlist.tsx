import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { playlistService } from "@/services/playlist.service";
import { useAuthStore } from "@/store/auth.store";
import { colors } from "@/theme/colors";

export default function PlaylistScreen() {
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const [name, setName] = useState("");

  const playlistsQuery = useQuery({
    queryKey: ["playlists", accessToken],
    queryFn: () => playlistService.list(),
    enabled: Boolean(accessToken),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Not authenticated");
      await playlistService.create(name);
    },
    onSuccess: () => {
      setName("");
      playlistsQuery.refetch();
    },
  });

  return (
    <Screen>
      <Text style={styles.title}>Playlists</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Playlist name"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
        />
        <Pressable style={styles.add} onPress={() => createMutation.mutate()}>
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={playlistsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>{item.name}</Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  add: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  addLabel: { color: colors.background, fontWeight: "700" },
  item: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
    marginBottom: 8,
  },
  itemText: { color: colors.textPrimary, fontWeight: "600" },
});
