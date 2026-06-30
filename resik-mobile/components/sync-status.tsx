import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Animated } from 'react-native';
import { useOfflineSync } from '../hooks/use-offline-sync';

/**
 * Floating sync status toast that appears at the bottom of the screen.
 *
 * Shows:
 * - "Laporan tersimpan di HP"      — after queuing offline
 * - "Laporan sedang dikirim..."    — while actively uploading
 * - "Laporan berhasil tersinkron!" — after successful upload
 * - "Akan dicoba lagi sebentar..." — after a failed attempt
 * - "{N} Laporan Tertunda"         — when there are queued items and no active event
 *
 * Disappears automatically after a few seconds.
 */
export function SyncStatus() {
  const { count, isSyncing, feedbackMessage } = useOfflineSync();
  const [fadeAnim] = React.useState(new Animated.Value(0));

  const shouldShow = feedbackMessage !== null || count > 0 || isSyncing;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, fadeAnim]);

  if (!shouldShow) return null;

  // Determine display text: feedback message takes priority over count badge
  const displayText = feedbackMessage
    ?? (isSyncing ? 'Laporan sedang dikirim...' : `${count} Laporan Tertunda`);

  // Determine if we should show a spinner or the count badge
  const showSpinner = isSyncing || feedbackMessage === 'Laporan sedang dikirim...';

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        {showSpinner ? (
          <ActivityIndicator size="small" color="#FFF" style={styles.loader} />
        ) : count > 0 && !feedbackMessage ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        ) : null}
        <Text style={styles.text}>{displayText}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loader: {
    marginRight: 10,
    transform: [{ scale: 0.8 }],
  },
  badge: {
    backgroundColor: '#FF5252',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },
  text: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
