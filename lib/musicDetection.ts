/**
 * Detects if the current YouTube video is a music video
 * Uses multiple heuristics for reliability
 */
export async function isMusicVideo(): Promise<boolean> {
    // Method 1: Check if on music.youtube.com
    if (window.location.hostname.includes("music.youtube.com")) {
        return true;
    }

    // Method 2: Check structured data (JSON-LD) for category
    const structuredData = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of structuredData) {
        try {
            const data = JSON.parse(script.textContent || "{}");
            // YouTube uses schema.org VideoObject
            if (data["@type"] === "VideoObject" || data["@type"] === "MusicVideoObject") {
                if (
                    data.genre === "Music" ||
                    data.videoCategory === "Music" ||
                    data.category === "Music"
                ) {
                    return true;
                }
            }
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (
                        (item["@type"] === "VideoObject" || item["@type"] === "MusicVideoObject") &&
                        (item.genre === "Music" ||
                            item.videoCategory === "Music" ||
                            item.category === "Music")
                    ) {
                        return true;
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    // Method 3: Check page metadata
    const categoryMeta = document.querySelector('meta[itemprop="genre"]');
    if (
        categoryMeta &&
        categoryMeta.getAttribute("content")?.toLowerCase().includes("music")
    ) {
        return true;
    }

    // Method 4: Check for music indicators in page structure
    const musicIndicators = [
        "music video",
        "official music video",
        "official audio",
        "song:",
    ];

    // Check title area for music indicators
    const titleElement = document.querySelector(
        "#title h1, ytd-watch-metadata h1, h1.ytd-watch-metadata"
    );
    if (titleElement) {
        const titleText = titleElement.textContent?.toLowerCase() || "";
        if (musicIndicators.some((indicator) => titleText.includes(indicator))) {
            return true;
        }
    }

    // Method 5: Check URL parameters and path
    const urlParams = new URLSearchParams(window.location.search);
    if (
        urlParams.get("list") &&
        (window.location.pathname.includes("/music/") ||
            urlParams.get("list")?.includes("RD"))
    ) {
        return true;
    }

    // Method 6: Check for music-related channel indicators
    const channelLink = document.querySelector(
        'ytd-channel-name a, #channel-name a, [class*="channel-name"] a'
    );
    if (channelLink) {
        const channelText = channelLink.textContent?.toLowerCase() || "";
        const musicChannelIndicators = [
            "vevo",
            "music",
            "records",
            "official",
            "audio",
        ];
        if (
            musicChannelIndicators.some((indicator) => channelText.includes(indicator))
        ) {
            // Weak signal, but might indicate music
            // We'll combine this with other signals
        }
    }

    return false;
}

