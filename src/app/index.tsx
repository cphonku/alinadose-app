import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getDoseForDate } from '../domain/dosing';
import { useApp } from '../state/AppContext';
import { Avatar, Caption, Card, Eyebrow, Screen, type IconName } from '../ui/components';
import { formatDate, formatDose, greeting } from '../ui/format';
import { colors, fonts, phaseColors, phaseLabels, radius, spacing } from '../ui/theme';

function HomeCard({
  title,
  subtitle,
  icon,
  tint,
  href,
  badge,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  tint: string;
  href: Href;
  badge?: string;
}) {
  return (
    <Card onPress={() => router.push(href)} accessibilityLabel={title} style={styles.homeCard}>
      <View style={[styles.iconBubble, { backgroundColor: tint + '22' }]}>
        <Ionicons name={icon} size={24} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Caption>{subtitle}</Caption>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: tint }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
      )}
    </Card>
  );
}

export default function Home() {
  const { data, records, status, today } = useApp();
  if (!data || !status) return null;

  const todayRecord = records[records.length - 1];
  const cycle = todayRecord?.date === today ? todayRecord.cycle : null;
  const loggedToday = todayRecord?.date === today && todayRecord.symptoms !== null;
  const dose = getDoseForDate(today, data.dosingPlan, data.periodStarts, data.profile.typicalCycleLength);
  const firstName = data.profile.displayName.split(' ')[0];

  const doseText =
    dose.status === 'planned' || dose.status === 'beyondPlan'
      ? `Today: ${formatDose(dose.amount, dose.unit)}`
      : status.phase === 'monitoring'
        ? 'Plan follows after monitoring'
        : 'Contact your physician';

  return (
    <Screen>
      <View style={styles.topBar}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="Lutealine" />
        <Avatar name={data.profile.displayName} onPress={() => router.push('/profile')} />
      </View>

      <Eyebrow>{formatDate(today)}</Eyebrow>
      <Text style={styles.greeting}>
        {greeting()}, <Text style={styles.greetingName}>{firstName}</Text>
      </Text>

      {cycle && (
        <View style={styles.cycleStrip}>
          <View style={[styles.phaseDot, { backgroundColor: phaseColors[cycle.phase] }]} />
          <Text style={styles.cycleText}>
            Cycle day <Text style={styles.cycleStrong}>{cycle.cycleDay}</Text> · {phaseLabels[cycle.phase]}
          </Text>
          {status.phase === 'monitoring' && status.monitoringCycle !== null && (
            <Text style={styles.monitoringPill}>
              Monitoring {Math.min(status.monitoringCycle, status.targetCycles)}/{status.targetCycles}
            </Text>
          )}
        </View>
      )}

      <View style={styles.cards}>
        <HomeCard title="Dosing plan" subtitle={doseText} icon="medkit-outline" tint={colors.petal} href="/dosing" />
        <HomeCard
          title="Log data"
          subtitle={loggedToday ? 'Done for today. Nice work!' : 'Test + questionnaire, ~4 min'}
          icon={loggedToday ? 'checkmark-circle-outline' : 'flask-outline'}
          tint={colors.coral}
          href="/log"
          badge={loggedToday ? undefined : 'Today'}
        />
        <HomeCard
          title="Data history"
          subtitle="Hormones and symptoms over your cycle"
          icon="analytics-outline"
          tint={colors.teal}
          href="/history"
        />
        <HomeCard
          title="Research news"
          subtitle="The latest studies on ADHD"
          icon="newspaper-outline"
          tint={colors.orange}
          href="/news"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  logo: { width: 64, height: 64 },
  greeting: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, marginTop: spacing.xs, letterSpacing: -0.3 },
  greetingName: { fontFamily: fonts.displayItalic, color: colors.coralDim },
  cycleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  cycleText: { fontFamily: fonts.body, fontSize: 15, color: colors.inkMid },
  cycleStrong: { fontFamily: fonts.bodyBold, color: colors.ink },
  monitoringPill: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.tealDim,
    backgroundColor: colors.teal + '1A',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  cards: { gap: spacing.md - 2, marginTop: spacing.xl },
  homeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 88 },
  iconBubble: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginBottom: 2 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.surface },
});
