import Foundation

/// Looks up a single Talmud daf audio URL from the AnyDaf Supabase episode_audio table.
struct TalmudAudioService {

    private static let supabaseURL = "https://zewdazoijdpakugfvnzt.supabase.co"
    private static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpld2Rhem9pamRwYWt1Z2Z2bnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzIwODYsImV4cCI6MjA5MDA0ODA4Nn0.HJxIG18vEpt-exzoQwRLeXiKLAinWfBl7gMORKjxIz8"

    /// SoundCloud client ID used by AudioPlayer to resolve stream URLs.
    /// Matches the value in the AnyDaf Supabase app_config table.
    static var soundcloudClientID = "tkIWLs4MIowq7bCXP80TOwx6DnDa7UPc"

    /// AnyTorah tractate name → Supabase/AnyDaf tractate name (where they differ).
    private static let nameMap: [String: String] = [
        "Eruvin":  "Eiruvin",
        "Chullin": "Hullin",
        "Taanit":  "Ta\u{2019}anit",   // U+2019 right single quotation mark
    ]

    /// Translates an AnyTorah tractate name to the name used in the Supabase table.
    static func supabaseName(for tractate: String) -> String {
        nameMap[tractate] ?? tractate
    }

    /// Fetches the audio URL for a daf (amud aleph = N.0).
    /// Returns a `soundcloud-track://ID` URL or a direct MP3 URL.
    static func audioURL(tractate: String, daf: Int) async -> URL? {
        let name = supabaseName(for: tractate)
        guard let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
        else { return nil }
        let urlStr = "\(supabaseURL)/rest/v1/episode_audio"
            + "?select=audio_url"
            + "&tractate=eq.\(encoded)"
            + "&daf=eq.\(Double(daf))"
            + "&limit=1"
        guard let url = URL(string: urlStr) else { return nil }
        var req = URLRequest(url: url)
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let rows = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              let first = rows.first,
              let urlString = first["audio_url"] as? String
        else { return nil }
        return URL(string: urlString)
    }
}
