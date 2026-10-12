import { Redirect } from 'expo-router';

/**
 * Unknown routes go home (the guards then pick welcome, onboarding or the
 * home screen). Also covers the hosted preview, whose page URL is not "/".
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
