import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { saveTestPhoto } from '../../services/photos';
import { useApp, useServices } from '../../state/AppContext';
import { useLogDraft } from '../../state/LogDraft';
import { Body, Button, Caption, Card, Eyebrow, Header, Screen } from '../../ui/components';
import { colors, fonts, radius, series, spacing } from '../../ui/theme';

type Step = 'camera' | 'analyzing' | 'result';

/**
 * Photographs the test and reads it. The reading itself currently comes from
 * the mock biosensor; image analysis is added once the biosensor exists.
 */
export default function Capture() {
  const { biosensor, repository } = useServices();
  const { data, today, refresh } = useApp();
  const { reading, setReading } = useLogDraft();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [step, setStep] = useState<Step>(reading ? 'result' : 'camera');
  const [error, setError] = useState<string | null>(null);
  const sampleType = data?.profile.preferredSampleType ?? 'saliva';

  const measure = async (photoCacheUri?: string) => {
    setError(null);
    setStep('analyzing');
    try {
      const photoUri = photoCacheUri ? await saveTestPhoto(photoCacheUri, today) : undefined;
      const result = await biosensor.measure({ sampleType });
      setReading(await repository.addReading(today, result, photoUri));
      await refresh();
      setStep('result');
    } catch {
      setError('The test could not be read. Please try again.');
      setStep('camera');
    }
  };

  const takePhoto = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.6 });
    if (photo?.uri) await measure(photo.uri);
  };

  if (step === 'analyzing') {
    return (
      <Screen scroll={false} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.coral} />
        <Text style={styles.analyzing}>Reading your test…</Text>
        <Caption>Measuring the reporter signal</Caption>
      </Screen>
    );
  }

  if (step === 'result' && reading) {
    return (
      <Screen>
        <Header title="Your result" />
        <Card style={styles.resultCard}>
          {reading.photoUri && <Image source={{ uri: reading.photoUri }} style={styles.photo} accessibilityLabel="Photo of your test" />}
          <Eyebrow>Progesterone · {reading.sampleType}</Eyebrow>
          <Text style={styles.value}>
            {reading.progesterone.toFixed(0)}
            <Text style={styles.unit}> {reading.unit}</Text>
          </Text>
          <Caption>Reporter signal {reading.reporterSignal.toFixed(0)} a.u.</Caption>
        </Card>
        {reading.source === 'mock' && (
          <Caption style={styles.mockNote}>Demo: this value is simulated while the biosensor is in development.</Caption>
        )}
        <Button title="Continue to questionnaire" icon="arrow-forward" onPress={() => router.push('/log/questionnaire')} style={{ marginTop: spacing.lg }} />
        <Button title="Retake" variant="ghost" onPress={() => { setReading(null); setStep('camera'); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Photograph your test" subtitle="Place the test window inside the frame" />
      {permission?.granted ? (
        <View style={styles.cameraBox}>
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setCameraReady(true)} />
          <View pointerEvents="none" style={styles.frame} />
        </View>
      ) : (
        <Card style={styles.permissionCard}>
          <Body>Alinadose needs the camera to read your test. Photos stay on this phone.</Body>
          <Button title="Allow camera" variant="secondary" icon="camera-outline" onPress={requestPermission} />
        </Card>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {permission?.granted && (
        <Button title="Take photo" icon="aperture-outline" onPress={takePhoto} disabled={!cameraReady} style={{ marginTop: spacing.lg }} />
      )}
      <Button title="No camera? Use a simulated test" variant="ghost" onPress={() => measure()} style={{ marginTop: spacing.xs }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  analyzing: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginTop: spacing.md },
  cameraBox: { height: 380, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '70%', height: 120, borderWidth: 3, borderColor: colors.sand, borderRadius: radius.md },
  permissionCard: { gap: spacing.md },
  resultCard: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  photo: { width: '100%', height: 160, borderRadius: radius.md, marginBottom: spacing.md },
  value: { fontFamily: fonts.display, fontSize: 56, color: series.progesterone },
  unit: { fontFamily: fonts.body, fontSize: 18, color: colors.inkSoft },
  mockNote: { textAlign: 'center', marginTop: spacing.sm },
  error: { fontFamily: fonts.bodyMedium, color: colors.danger, marginTop: spacing.sm },
});
