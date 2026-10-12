import { fetchArticles, parseSummary } from '../news/pubmed';

const summary = {
  result: {
    uids: ['111', '222'],
    '111': {
      title: 'Progesterone and <i>ADHD</i> symptoms',
      fulljournalname: 'Journal of Tests',
      pubdate: '2026 Oct',
      authors: [{ name: 'A B' }, { name: 'C D' }, { name: 'E F' }, { name: 'G H' }],
    },
    '222': { source: 'J Short', pubdate: '2026 Sep', authors: [{ name: 'X Y' }] },
  },
};

describe('PubMed news', () => {
  it('parses summaries, strips markup and shortens author lists', () => {
    const [a, b] = parseSummary(summary);
    expect(a).toEqual({
      id: '111',
      title: 'Progesterone and ADHD symptoms',
      journal: 'Journal of Tests',
      date: '2026 Oct',
      authors: 'A B, C D, E F et al.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/111/',
    });
    expect(b).toMatchObject({ title: 'Untitled', journal: 'J Short', authors: 'X Y' });
  });

  it('searches then fetches summaries, sending only the search term', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      const body = url.includes('esearch') ? { esearchresult: { idlist: ['111', '222'] } } : summary;
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch;

    const articles = await fetchArticles('hormones', 2, fakeFetch);
    expect(articles).toHaveLength(2);
    expect(calls[0]).toContain('esearch.fcgi');
    expect(decodeURIComponent(calls[0]!)).toContain('progesterone');
    expect(calls[1]).toContain('id=111,222');
  });

  it('throws on HTTP errors', async () => {
    const failing = (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    await expect(fetchArticles('all', 5, failing)).rejects.toThrow('PubMed search failed');
  });
});
