import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fetchArticles, type Article, type NewsTopic } from '../services/news/pubmed';
import { Body, Button, Caption, Card, Eyebrow, Header, Screen, Segmented } from '../ui/components';
import { colors, fonts, spacing } from '../ui/theme';

export default function News() {
  const [topic, setTopic] = useState<NewsTopic>('hormones');
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState(false);
  // Kept for this session so switching tabs doesn't refetch.
  const cache = useRef(new Map<NewsTopic, Article[]>());

  const load = useCallback(async (t: NewsTopic) => {
    setError(false);
    const cached = cache.current.get(t);
    if (cached) {
      setArticles(cached);
      return;
    }
    setArticles(null);
    try {
      const result = await fetchArticles(t);
      cache.current.set(t, result);
      setArticles(result);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load(topic);
  }, [topic, load]);

  return (
    <Screen>
      <Header title="Research news" subtitle="Newest studies from PubMed" />
      <Segmented
        options={[
          { value: 'hormones', label: 'ADHD & hormones' },
          { value: 'all', label: 'All ADHD' },
        ]}
        value={topic}
        onChange={setTopic}
      />
      <View style={styles.list}>
        {error ? (
          <Card style={{ gap: spacing.md }}>
            <Body>Could not load articles. Check your internet connection.</Body>
            <Button title="Try again" variant="secondary" onPress={() => load(topic)} />
          </Card>
        ) : articles === null ? (
          <ActivityIndicator color={colors.coral} style={{ marginTop: spacing.xl }} />
        ) : articles.length === 0 ? (
          <Body>No articles found.</Body>
        ) : (
          articles.map((a) => (
            <Card key={a.id} onPress={() => WebBrowser.openBrowserAsync(a.url)} accessibilityLabel={a.title} style={styles.article}>
              <Eyebrow numberOfLines={1}>
                {a.date} · {a.journal}
              </Eyebrow>
              <Text style={styles.title}>{a.title}</Text>
              <View style={styles.footer}>
                <Caption numberOfLines={1} style={{ flex: 1 }}>
                  {a.authors}
                </Caption>
                <Ionicons name="open-outline" size={16} color={colors.inkSoft} />
              </View>
            </Card>
          ))
        )}
      </View>
      <Caption style={{ textAlign: 'center', marginTop: spacing.lg }}>
        Articles are from PubMed (U.S. National Library of Medicine). Alinadose does not review them.
      </Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: spacing.md, gap: spacing.sm + 2 },
  article: { gap: spacing.xs + 2 },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 23, color: colors.ink },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
