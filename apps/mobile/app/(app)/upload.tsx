import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { songService } from "@/services/song.service";
import { useAuthStore } from "@/store/auth.store";
import { colors } from "@/theme/colors";

export default function UploadScreen() {
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("You must be logged in");
      if (!audioUri) throw new Error("Select an audio file");
      return songService.createSong({ title, genre }, { audioUri, coverUri: coverUri ?? undefined });
    },
    onSuccess: () => {
      setTitle("");
      setGenre("");
      setAudioUri(null);
      setCoverUri(null);
      setStatus("Song uploaded");
    },
    onError: (error) => {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    },
  });

  return (
    <Screen>
      <Text style={styles.title}>Upload Song</Text>
      <TextInput
        style={styles.input}
        placeholder="Song title"
        placeholderTextColor={colors.textSecondary}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Genre"
        placeholderTextColor={colors.textSecondary}
        value={genre}
        onChangeText={setGenre}
      />

      <Pressable
        style={styles.pick}
        onPress={async () => {
          const file = await songService.pickAudioFile();
          if (file) setAudioUri(file.uri);
        }}
      >
        <Text style={styles.pickLabel}>{audioUri ? "Audio selected" : "Pick MP3/WAV"}</Text>
      </Pressable>

      <Pressable
        style={styles.pick}
        onPress={async () => {
          const image = await songService.pickCoverImage();
          if (image) setCoverUri(image.uri);
        }}
      >
        <Text style={styles.pickLabel}>{coverUri ? "Cover selected" : "Pick cover image"}</Text>
      </Pressable>

      <Pressable style={styles.submit} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
        <Text style={styles.submitLabel}>{mutation.isPending ? "Uploading..." : "Upload"}</Text>
      </Pressable>

      <View style={styles.aiBox}>
        <Text style={styles.aiTitle}>AI placeholders</Text>
        <Text style={styles.aiText}>- Genre detection hook</Text>
        <Text style={styles.aiText}>- Creator optimization suggestions</Text>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
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
    marginBottom: 10,
  },
  pick: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  pickLabel: { color: colors.textPrimary },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },
  submitLabel: { color: colors.background, fontWeight: "700" },
  aiBox: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  aiTitle: { color: colors.textPrimary, fontWeight: "700", marginBottom: 8 },
  aiText: { color: colors.textSecondary, marginBottom: 4 },
  status: { color: colors.textSecondary, marginTop: 12 },
});
