import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Body, Button, Caption, Eyebrow, Screen } from '../ui/components';
import { colors, fonts, spacing } from '../ui/theme';

export default function Welcome() {
  const { startDemo } = useApp();
  const [loading, setLoading] = useState(false);

  return (
    <Screen scroll={false} style={styles.container}>
      <View style={styles.hero}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="Lutealine logo" />
        <Eyebrow style={styles.eyebrow}>Hormone-aware ADHD care</Eyebrow>
        <Text style={styles.brand}>Lutealine</Text>
        <Text style={styles.tagline}>Your cycle. Your symptoms. Your dose.</Text>
        <Body style={styles.body}>
          Measure progesterone at home, track your ADHD symptoms day by day, and give your physician the full picture
          to personalise your treatment.
        </Body>
      </View>

      <View style={styles.actions}>
        <Button title="Create account" onPress={() => router.push({ pathname: '/auth', params: { mode: 'signup' } })} />
        <Button title="Sign in" variant="secondary" onPress={() => router.push({ pathname: '/auth', params: { mode: 'signin' } })} />
        <Button
          title="Explore the demo"
          variant="ghost"
          icon="sparkles-outline"
          loading={loading}
          onPress={async () => {
            setLoading(true);
            try {
              await startDemo();
            } finally {
              setLoading(false);
            }
          }}
        />
        {Platform.OS === 'web' && (
          <Button title="Physician portal (demo)" variant="ghost" icon="medkit-outline" onPress={() => router.push('/physician')} />
        )}
        <Caption style={styles.footer}>U Copenhagen iGEM 2026</Caption>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between', paddingBottom: spacing.lg },
  hero: { alignItems: 'center', marginTop: spacing.xl },
  logo: { width: 150, height: 150, marginBottom: spacing.md },
  eyebrow: { color: colors.coralDim, marginBottom: spacing.xs },
  brand: { fontFamily: fonts.display, fontSize: 46, color: colors.ink, letterSpacing: -0.5 },
  tagline: { fontFamily: fonts.displayItalic, fontSize: 19, color: colors.petalDim, marginTop: spacing.xs },
  body: { textAlign: 'center', marginTop: spacing.lg, maxWidth: 340 },
  actions: { gap: spacing.sm + 2 },
  footer: { textAlign: 'center', marginTop: spacing.sm },
});
