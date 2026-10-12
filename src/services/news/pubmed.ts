/**
 * Recent ADHD research from PubMed (NCBI E-utilities, free, no key needed for
 * low traffic). Only a search term is sent; no patient data ever leaves the app.
 */
export interface Article {
  id: string;
  title: string;
  journal: string;
  date: string;
  authors: string;
  url: string;
}

export type NewsTopic = 'hormones' | 'all';

const ADHD = '("attention deficit hyperactivity disorder"[tiab] OR ADHD[tiab])';
const QUERIES: Record<NewsTopic, string> = {
  hormones: `${ADHD} AND (menstrua*[tiab] OR premenstrual[tiab] OR luteal[tiab] OR progesterone[tiab] OR estrogen[tiab] OR oestrogen[tiab] OR estradiol[tiab] OR hormon*[tiab] OR menopaus*[tiab])`,
  all: ADHD,
};

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

interface SummaryResult {
  title?: string;
  fulljournalname?: string;
  source?: string;
  pubdate?: string;
  authors?: { name: string }[];
}

export function parseSummary(json: { result?: Record<string, unknown> & { uids?: string[] } }): Article[] {
  const result = json.result;
  if (!result?.uids) return [];
  return result.uids.map((id) => {
    const r = result[id] as SummaryResult;
    const names = (r.authors ?? []).map((a) => a.name);
    return {
      id,
      title: (r.title ?? 'Untitled').replace(/<[^>]+>/g, ''),
      journal: r.fulljournalname || r.source || '',
      date: r.pubdate ?? '',
      authors: names.length > 3 ? `${names.slice(0, 3).join(', ')} et al.` : names.join(', '),
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    };
  });
}

export async function fetchArticles(
  topic: NewsTopic,
  count = 20,
  fetchFn: typeof fetch = fetch,
): Promise<Article[]> {
  const search = await fetchFn(
    `${BASE}/esearch.fcgi?db=pubmed&retmode=json&sort=pub_date&retmax=${count}&term=${encodeURIComponent(QUERIES[topic])}`,
  );
  if (!search.ok) throw new Error(`PubMed search failed (${search.status})`);
  const ids: string[] = (await search.json()).esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const summary = await fetchFn(`${BASE}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`);
  if (!summary.ok) throw new Error(`PubMed summary failed (${summary.status})`);
  return parseSummary(await summary.json());
}
