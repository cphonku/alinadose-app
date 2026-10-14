import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../state/AppContext';
import { colors, MAX_APP_WIDTH } from '../ui/theme';

function Splash() {
  return (
    <View style={splash.container}>
      <Image source={require('../../assets/logo.png')} style={splash.logo} accessibilityLabel="Alinadose" />
      <ActivityIndicator color={colors.coral} />
    </View>
  );
}

function RootStack() {
  const { ready, user, data } = useApp();
  if (!ready) return <Splash />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="auth" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !data}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !!data}>
        <Stack.Screen name="index" />
        <Stack.Screen name="dosing" />
        <Stack.Screen name="plan-editor" />
        <Stack.Screen name="plan-review" />
        <Stack.Screen name="log" />
        <Stack.Screen name="history" />
        <Stack.Screen name="news" />
        <Stack.Screen name="profile" />
      </Stack.Protected>
      {/* Demo physician portal: not part of the patient's account. Listed last so
          guarded routes fall back to the welcome screen, not here. */}
      <Stack.Screen name="physician" />
    </Stack>
  );
}

/** On web, center the app in a phone-width column. */
function Frame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={splash.webOuter}>
      <View style={splash.webInner}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Frame>
        <AppProvider>{fontsLoaded ? <RootStack /> : <Splash />}</AppProvider>
      </Frame>
    </SafeAreaProvider>
  );
}

const splash = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 24 },
  logo: { width: 140, height: 140 },
  webOuter: { flex: 1, alignItems: 'center', backgroundColor: colors.wheat },
  webInner: { flex: 1, width: '100%', maxWidth: MAX_APP_WIDTH, overflow: 'hidden', backgroundColor: colors.background },
});
