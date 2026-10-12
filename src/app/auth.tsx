import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthError } from '../services/auth/AuthService';
import { useApp, useServices } from '../state/AppContext';
import { Body, Button, Caption, Header, Screen } from '../ui/components';
import { Field } from '../ui/Field';
import { colors, fonts, spacing } from '../ui/theme';

export default function Auth() {
  const { mode } = useLocalSearchParams<{ mode?: 'signin' | 'signup' }>();
  const signingUp = mode !== 'signin';
  const { auth } = useServices();
  const { setUser } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = signingUp ? await auth.signUp(email, password, name) : await auth.signIn(email, password);
      setUser(user);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title={signingUp ? 'Create account' : 'Welcome back'} />
      <Body style={{ marginBottom: spacing.lg }}>
        {signingUp
          ? 'Your data stays on this phone. You decide when it is shared with your physician.'
          : 'Sign in to continue tracking.'}
      </Body>
      {signingUp && <Field label="Name" value={name} onChangeText={setName} autoComplete="name" placeholder="Your name" />}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        placeholder={signingUp ? 'At least 8 characters' : 'Password'}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={signingUp ? 'Create account' : 'Sign in'} onPress={submit} loading={loading} style={{ marginTop: spacing.md }} />
      <Caption style={{ textAlign: 'center', marginTop: spacing.md }}>
        Demo version: the account is stored only on this device.
      </Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.bodyMedium, color: colors.danger, marginTop: spacing.xs },
});
