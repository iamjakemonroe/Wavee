import { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { usePlayerStore } from "@/store/player.store";
import { colors } from "@/theme/colors";

export default function PlayerScreen() {
  const { currentSong, isPlaying, setIsPlaying } = usePlayerStore();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [progressLabel, setProgressLabel] = useState("0:00");

  useEffect(() => {
    async function setup() {
      if (!currentSong?.audio_url) return;

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: currentSong.audio_url },
        { shouldPlay: isPlaying }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        const seconds = Math.floor(status.positionMillis / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = `${seconds % 60}`.padStart(2, "0");
        setProgressLabel(`${mins}:${secs}`);
      });
    }
    void setup();

    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [currentSong?.audio_url, isPlaying]);

  const togglePlayback = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <Screen>
      <Text style={styles.title}>Player</Text>
      <Text style={styles.song}>{currentSong?.title ?? "Nothing playing"}</Text>
      <Text style={styles.progress}>{progressLabel}</Text>

      <Pressable style={styles.btn} onPress={togglePlayback} disabled={!currentSong}>
        <Text style={styles.btnLabel}>{isPlaying ? "Pause" : "Play"}</Text>
      </Pressable>

      <View style={styles.premiumBox}>
        <Text style={styles.premiumTitle}>Premium-only placeholder</Text>
        <Text style={styles.premiumText}>Background play and offline download gates go here.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  song: { color: colors.textPrimary, fontSize: 20, fontWeight: "700" },
  progress: { color: colors.textSecondary, marginTop: 8, marginBottom: 16 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnLabel: { color: colors.background, fontWeight: "700" },
  premiumBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
  },
  premiumTitle: { color: colors.textPrimary, fontWeight: "700", marginBottom: 6 },
  premiumText: { color: colors.textSecondary },
});
