import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RemotePlanError, normalizePatientCode, type RemotePlan } from '../services/plans/RemotePlanService';
import { useServices } from '../state/AppContext';
import { Body, Button, Caption, Card, Eyebrow, Header, Screen } from '../ui/components';
import { Field } from '../ui/Field';
import { PlanEditorForm } from '../ui/PlanEditorForm';
import { colors, fonts, spacing } from '../ui/theme';

type Loaded = { code: string; plan: RemotePlan | null };

function describeError(e: unknown): string {
  if (e instanceof RemotePlanError) {
    if (e.code === 'notConfigured') return 'No plan server is configured for this device.';
    if (e.code === 'network') return 'Could not reach the plan server. Is the demo relay running (npm run relay)?';
    return e.message;
  }
  return 'Something went wrong.';
}

/**
 * DEMO physician portal: open a patient by their code, edit the dosing plan
 * and publish it. The patient's app picks it up as a plan to review.
 * No physician login yet — accounts and access control come with the GDPR work.
 */
export default function PhysicianPortal() {
  const { remotePlans } = useServices();
  const [code, setCode] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [published, setPublished] = useState<RemotePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    const patientCode = normalizePatientCode(code);
    if (!patientCode) return;
    setError(null);
    setPublished(null);
    setLoading(true);
    try {
      setLoaded({ code: patientCode, plan: await remotePlans.fetchLatest(patientCode) });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header title="Physician portal" subtitle="Demo · Lutealine for clinicians" />

      <Card style={styles.card}>
        <Eyebrow>Patient</Eyebrow>
        <Field
          label="Patient code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="e.g. LUT-4F7K2 or DEMO-01"
          onSubmitEditing={open}
        />
        <Button title="Open patient" icon="person-outline" onPress={open} loading={loading} disabled={!code.trim()} />
        <Caption>The patient finds their code in the app under Profile.</Caption>
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}

      {published && (
        <Card style={[styles.card, styles.success]}>
          <Text style={styles.successTitle}>Plan v{published.version} sent to {published.patientCode}</Text>
          <Caption style={{ color: colors.surface }}>
            The patient sees it the next time the app checks for updates, and confirms it before it is used.
          </Caption>
        </Card>
      )}

      {loaded && (
        <View>
          <Body style={{ marginBottom: spacing.md }}>
            {loaded.plan
              ? `Current plan for ${loaded.code}: version ${loaded.plan.version}, published ${loaded.plan.publishedAt.slice(0, 10)}. Edit and publish to send a new version.`
              : `No plan published for ${loaded.code} yet. Write the first plan below.`}
          </Body>
          <PlanEditorForm
            key={`${loaded.code}-${loaded.plan?.version ?? 0}`}
            initial={loaded.plan}
            submitLabel="Publish plan to patient"
            onSubmit={async (draft) => {
              try {
                const plan = await remotePlans.publish(loaded.code, draft);
                setPublished(plan);
                setLoaded({ code: loaded.code, plan });
              } catch (e) {
                throw new Error(describeError(e));
              }
            }}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  error: { fontFamily: fonts.bodyMedium, color: colors.danger, marginBottom: spacing.md },
  success: { backgroundColor: colors.teal, borderColor: colors.teal },
  successTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.surface },
});
