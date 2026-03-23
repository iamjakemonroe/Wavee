import type { Song } from "@/types/entities";

export const mockSongs: Song[] = Array.from({ length: 6 }).map((_, index) => ({
  id: `mock-${index + 1}`,
  user_id: "mock-user",
  title: `Wave Track ${index + 1}`,
  genre: index % 2 === 0 ? "electronic" : "lofi",
  audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  cover_image_url: null,
  plays_count: 100 + index * 10,
  likes_count: 15 + index * 3,
  created_at: new Date().toISOString(),
  score: 42 + index,
}));
