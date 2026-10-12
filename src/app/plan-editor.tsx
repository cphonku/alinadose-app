import { router } from 'expo-router';
import { useApp, useServices } from '../state/AppContext';
import { Body, Header, Screen } from '../ui/components';
import { PlanEditorForm } from '../ui/PlanEditorForm';
import { spacing } from '../ui/theme';

/**
 * DEMO: enter a physician's plan directly on the patient's device. Normally
 * the physician publishes it from the physician portal and the app receives it.
 */
export default function PlanEditor() {
  const { repository } = useServices();
  const { data, today, refresh } = useApp();

  return (
    <Screen>
      <Header title="Plan on this device" subtitle="Demo · normally sent by your physician" />
      <Body style={{ marginBottom: spacing.lg }}>
        Fill this in together with your physician. Saving replaces the current plan from today; the previous plan is kept in
        the history.
      </Body>
      <PlanEditorForm
        initial={data?.dosingPlan ?? null}
        defaultMedication={data?.profile.medicationName}
        defaultLength={data?.profile.typicalCycleLength}
        submitLabel="Save plan"
        onSubmit={async (draft) => {
          await repository.saveDosingPlan({ ...draft, validFrom: today });
          await refresh();
          router.back();
        }}
      />
    </Screen>
  );
}
