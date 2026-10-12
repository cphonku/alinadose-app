import { Directory, File, Paths } from 'expo-file-system';

/** Copies a camera photo of the test from the cache into permanent app storage. */
export async function saveTestPhoto(cacheUri: string, date: string): Promise<string> {
  const dir = new Directory(Paths.document, 'test-photos');
  dir.create({ idempotent: true, intermediates: true });
  const source = new File(cacheUri);
  const target = new File(dir, `${date}-${Date.now()}.jpg`);
  await source.copy(target, { overwrite: true });
  return target.uri;
}
