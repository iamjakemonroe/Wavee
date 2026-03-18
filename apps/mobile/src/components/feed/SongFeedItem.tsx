import { memo, useEffect, useRef } from "react";
import { Audio } from "expo-av";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HomeFeedSong } from "@/types/entities";
import { colors } from "@/theme/colors";

interface SongFeedItemProps {
  song: HomeFeedSong;
  isActive: boolean;
  onLike?: (songId: string) => void;
}

export const SongFeedItem = memo(function SongFeedItem({
  song,
  isActive,
  onLike,
}: SongFeedItemProps) {
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    async function setPlayback() {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: song.audio_url },
          { shouldPlay: isActive, isLooping: true, volume: 1 }
        );
        soundRef.current = sound;
        return;
      }

      if (isActive) {
        await soundRef.current.playAsync();
      } else {
        await soundRef.current.pauseAsync();
      }
    }

    void setPlayback();

    return () => {
      if (!isActive) return;
      void soundRef.current?.stopAsync();
    };
  }, [isActive, song.audio_url]);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.meta}>{song.genre}</Text>
        <Text style={styles.meta}>score: {song.score.toFixed(2)}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => onLike?.(song.id)}>
          <Text style={styles.buttonText}>Like</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    justifyContent: "space-between",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonText: {
    color: colors.background,
    fontWeight: "700",
  },
});
