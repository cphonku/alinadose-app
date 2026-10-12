import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { TEST_INSTRUCTIONS } from '../../content/testInstructions';
import { useApp } from '../../state/AppContext';
import { Body, Button, Caption, Header, Screen } from '../../ui/components';
import { colors, fonts, spacing } from '../../ui/theme';

export default function Instructions() {
  const { data } = useApp();
  const sampleType = data?.profile.preferredSampleType ?? 'saliva';
  const steps = TEST_INSTRUCTIONS[sampleType];

  return (
    <Screen>
      <Header title="Instructions" subtitle={`Progesterone test · ${sampleType}`} />
      <View style={styles.list}>
        {steps.map((step, i) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.number}>
              <Text style={styles.numberText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Body>{step.detail}</Body>
            </View>
          </View>
        ))}
      </View>
      <Button title="Next" icon="camera-outline" onPress={() => router.push('/log/capture')} />
      <Button
        title="Skip the test today"
        variant="ghost"
        onPress={() => router.push('/log/questionnaire')}
        style={{ marginTop: spacing.xs }}
      />
      <Caption style={{ textAlign: 'center' }}>You can still fill in the questionnaire without a test.</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg, marginBottom: spacing.xl },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  number: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontFamily: fonts.display, fontSize: 20, color: colors.surface },
  stepTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginBottom: 2 },
});
