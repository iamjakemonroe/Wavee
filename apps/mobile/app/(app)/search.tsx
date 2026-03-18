import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { searchService } from "@/services/search.service";
import { colors } from "@/theme/colors";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const { data } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchService.searchSongs(query),
    enabled: query.trim().length > 1,
  });

  return (
    <Screen>
      <Text style={styles.title}>Search</Text>
      <TextInput
        style={styles.input}
        placeholder="Songs, artists, genres"
        placeholderTextColor={colors.textSecondary}
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.song}>{item.title}</Text>
            <Text style={styles.genre}>{item.genre}</Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  song: { color: colors.textPrimary, fontSize: 16, fontWeight: "600" },
  genre: { color: colors.textSecondary, marginTop: 4 },
});
