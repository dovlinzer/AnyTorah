// Iggros Moshe podcast citations ("Iggros Moshe A to Z", Rabbi Dov Linzer,
// soundcloud.com/iggrosmosheatoz) — a "here's where to find it" indicator, not a player. Ported
// from native's IggrosMoshePodcastService.swift/.kt + the bundled
// iggros_moshe_podcast_citations.json (see AnyTorah/CLAUDE.md's "Iggros Moshe podcast citations"
// section for how this hand-curated data was built from a Google Sheet).

export interface PodcastEpisode {
  audioUrl: string;
  episodeNumber: number;
  title: string;
}

export interface CitedEpisode extends PodcastEpisode {
  id: string;
}

interface PodcastCitationsData {
  episodes: Record<string, PodcastEpisode>;
  citations: Record<string, Record<string, string[]>>;
}

let dataCache: PodcastCitationsData | null = null;
let dataInflight: Promise<PodcastCitationsData> | null = null;

/** Fetches and caches public/iggrosMoshePodcastCitations.json. */
export function loadIggrosMoshePodcastCitations(): Promise<PodcastCitationsData> {
  if (dataCache) return Promise.resolve(dataCache);
  if (!dataInflight) {
    dataInflight = fetch("/iggrosMoshePodcastCitations.json")
      .then((res) => res.json())
      .then((json: PodcastCitationsData) => {
        dataCache = json;
        return json;
      })
      .catch(() => {
        dataInflight = null;
        return { episodes: {}, citations: {} } as PodcastCitationsData;
      });
  }
  return dataInflight;
}

/** Episodes discussing an exact siman. Unlike native's page->siman floor lookup (its own nav
 *  state is page-based, so it resolves "what siman is currently on screen" via
 *  TeshuvotPageManager.siman before it can look up citations), the web reader's `chapter` for
 *  Iggros Moshe already IS the siman being navigated by — so this is a direct exact-match lookup,
 *  no floor needed. */
export function citedEpisodesFor(data: PodcastCitationsData | null, volumeId: string, siman: number): CitedEpisode[] {
  const ids = data?.citations[volumeId]?.[String(siman)];
  if (!ids || !data) return [];
  return ids
    .map((id) => {
      const ep = data.episodes[id];
      return ep ? { id, ...ep } : null;
    })
    .filter((e): e is CitedEpisode => e != null);
}

const thumbnailCache = new Map<string, Promise<string | null>>();

/** SoundCloud's public oEmbed endpoint returns a real per-episode thumbnail (500x500), no auth
 *  needed, and is CORS-open (confirmed live: `access-control-allow-origin: *`) — so this fetches
 *  directly from the browser rather than through a server proxy (unlike the Drive thumbnail
 *  proxy, which exists specifically to dodge a browser-only failure mode Drive doesn't have
 *  here). Cached in-memory by episode URL for the session, not persisted — cheap and always
 *  fresh, matching native's own in-memory-cache-by-episode-id shape. */
export function loadEpisodeThumbnail(audioUrl: string): Promise<string | null> {
  const cached = thumbnailCache.get(audioUrl);
  if (cached) return cached;
  const promise = fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(audioUrl)}&format=json`)
    .then((res) => (res.ok ? res.json() : null))
    .then((json: { thumbnail_url?: string } | null) => json?.thumbnail_url ?? null)
    .catch(() => null);
  thumbnailCache.set(audioUrl, promise);
  return promise;
}
