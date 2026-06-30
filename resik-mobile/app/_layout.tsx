import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import { useColorScheme } from '../hooks/use-color-scheme';
import { AuthProvider, useAuthContext } from '../hooks/auth-context';
import { useOfflineSync } from '../hooks/use-offline-sync';

const MAX_LOADING_MS = 10 * 1000; // 10 seconds

/**
 * Mounts the offline sync engine at the root level so that:
 * - Network events trigger sync regardless of which screen is active
 * - App foreground events trigger sync even if the user is on the Profile tab
 * - The SyncStatus toast is available app-wide
 *
 * This component renders nothing — it only activates the hook.
 */
function OfflineSyncEngine() {
  // Mounting this hook here wires up all NetInfo and AppState listeners
  // at the root level for the lifetime of the authenticated session.
  useOfflineSync();
  return null;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading, signOut } = useAuthContext();
  const segments = useSegments();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (!loading) {
      setLoadingTimeout(false);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
      return;
    }

    // Only apply timeout on subsequent auth checks, not initial load
    if (isInitialLoad) return;

    const timer = setTimeout(() => {
      setLoadingTimeout(true);
      signOut();
    }, MAX_LOADING_MS);

    return () => clearTimeout(timer);
  }, [loading, isInitialLoad, signOut]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>
          {loadingTimeout ? 'Sesi kedaluwarsa, silakan login ulang' : 'Memuat...'}
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Mount sync engine at root so it runs across all tabs */}
      {user && <OfflineSyncEngine />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});
