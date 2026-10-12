/** Web: camera photos are already data URIs; nothing to copy. */
export async function saveTestPhoto(uri: string): Promise<string> {
  return uri;
}
