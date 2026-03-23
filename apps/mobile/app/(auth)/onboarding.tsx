import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { Screen } from "@/components/ui/Screen";
import { authService } from "@/services/auth.service";
import { colors } from "@/theme/colors";

export default function OnboardingScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isSignUp, setSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const data = await authService.signUp({ email, password, username });
        if (!data.session) {
          Toast.show({
            type: "success",
            text1: "Confirm your email",
            text2: "Check your inbox and click the confirmation link to continue.",
            position: "bottom",
          });
        } else {
          Toast.show({
            type: "success",
            text1: "Account created",
            text2: "You are signed in and ready to discover music.",
            position: "bottom",
          });
        }
      } else {
        await authService.signIn({ email, password });
        Toast.show({
          type: "success",
          text1: "Welcome back",
          text2: "You are signed in.",
          position: "bottom",
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Authentication failed";
      setError(message);
      Toast.show({
        type: "error",
        text1: "Authentication error",
        text2: message,
        position: "bottom",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Wavee</Text>
        <Text style={styles.subtitle}>Discover and share music that deserves to trend.</Text>

        {isSignUp ? (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.cta} onPress={onSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.ctaLabel}>{isSignUp ? "Create account" : "Sign in"}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => setSignUp((current) => !current)}>
          <Text style={styles.link}>
            {isSignUp
              ? "Already have an account? Sign in"
              : "Need an account? Create one"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: 12 },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  ctaLabel: {
    color: colors.background,
    fontWeight: "700",
  },
  link: {
    color: colors.secondary,
    textAlign: "center",
    marginTop: 8,
  },
  error: {
    color: colors.danger,
  },
});
