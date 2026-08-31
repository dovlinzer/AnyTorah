import Foundation

/// One "Iggros Moshe A to Z" podcast episode (Rabbi Dov Linzer) that discusses the current
/// Contemporary Teshuvot siman — sourced from a manually-maintained Google Sheet ("Shutim
/// References" tab, filtered to Name of Shu"t == "Iggrot Moshe"), bundled as a static JSON
/// asset rather than synced live — see CLAUDE.md's "Iggros Moshe podcast citations" section.
struct PodcastEpisodeCitation: Identifiable, Hashable {
    let id: String
    let title: String
    let episodeNumber: Int
    let audioUrl: String
}

/// Loads iggros_moshe_podcast_citations.json from the app bundle (same
/// bundle-JSON-at-init shape as `TeshuvotPageManager`) and fetches per-episode artwork from
/// SoundCloud's public oEmbed endpoint (no API key needed) — the sheet itself has no artwork
/// column.
///
/// iggros_moshe_podcast_citations.json format:
///   { "episodes": { "13": {"title": "…", "episodeNumber": 13, "audioUrl": "…"}, … },
///     "citations": { "IggrotMosheEH2": { "17": ["13", "14"], … }, … } }
final class IggrosMoshePodcastService {
    static let shared = IggrosMoshePodcastService()

    private let episodes: [String: PodcastEpisodeCitation]
    /// [volumeId: [siman: [episodeId]]]
    private let citations: [String: [String: [String]]]

    private var artworkCache: [String: URL] = [:]
    private var inFlightArtwork: [String: Task<URL?, Never>] = [:]

    private init() {
        struct Bundled: Decodable {
            struct Episode: Decodable { let title: String; let episodeNumber: Int; let audioUrl: String }
            let episodes: [String: Episode]
            let citations: [String: [String: [String]]]
        }
        guard
            let url = Bundle.main.url(forResource: "iggros_moshe_podcast_citations", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let bundled = try? JSONDecoder().decode(Bundled.self, from: data)
        else {
            episodes = [:]
            citations = [:]
            return
        }
        episodes = bundled.episodes.reduce(into: [:]) { acc, pair in
            let (id, e) = pair
            acc[id] = PodcastEpisodeCitation(id: id, title: e.title, episodeNumber: e.episodeNumber, audioUrl: e.audioUrl)
        }
        citations = bundled.citations
    }

    /// Every episode that discusses this volume+siman, in a stable order (by episode number) —
    /// empty if none. Purely synchronous, from bundled data — no network involved.
    func citedEpisodes(volume: String, siman: Int) -> [PodcastEpisodeCitation] {
        guard let episodeIds = citations[volume]?[String(siman)] else { return [] }
        return episodeIds.compactMap { episodes[$0] }.sorted { $0.episodeNumber < $1.episodeNumber }
    }

    /// SoundCloud's public oEmbed thumbnail for this episode, cached by episode id. The sheet
    /// has no artwork column, so this is the only artwork source — no auth/API key needed.
    func artworkURL(for episode: PodcastEpisodeCitation) async -> URL? {
        if let cached = artworkCache[episode.id] { return cached }
        if let existing = inFlightArtwork[episode.id] { return await existing.value }

        let task = Task<URL?, Never> {
            var comps = URLComponents(string: "https://soundcloud.com/oembed")!
            comps.queryItems = [
                URLQueryItem(name: "url", value: episode.audioUrl),
                URLQueryItem(name: "format", value: "json"),
            ]
            guard let url = comps.url,
                  let (data, response) = try? await URLSession.shared.data(from: url),
                  (response as? HTTPURLResponse)?.statusCode == 200,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let thumbString = json["thumbnail_url"] as? String
            else { return nil }
            return URL(string: thumbString)
        }
        inFlightArtwork[episode.id] = task
        let result = await task.value
        inFlightArtwork[episode.id] = nil
        if let result { artworkCache[episode.id] = result }
        return result
    }
}
