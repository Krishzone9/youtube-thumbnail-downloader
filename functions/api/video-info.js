export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    if (!targetUrl || (!targetUrl.includes('youtube.com/') && !targetUrl.includes('youtu.be/'))) {
        return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400, headers: corsHeaders });
    }

    const videoIdMatch = targetUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([^&?/\s]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
        return new Response(JSON.stringify({ error: 'Video ID not found' }), { status: 400, headers: corsHeaders });
    }

    let title = '';
    let description = '';

    // --- Utility: unescape HTML entities ---
    function unescapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&#10;/g, '\n');
    }

    // ===== METHOD 1: YouTube Data API v3 (most reliable) =====
    const apiKey = env.YOUTUBE_API_KEY || '';
    if (apiKey) {
        try {
            const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    const snippet = data.items[0].snippet;
                    title = snippet.title || '';
                    description = snippet.description || '';
                }
            }
        } catch (error) {
            console.error('YouTube API v3 error:', error.message);
        }
    }

    // ===== METHOD 2: Scrape YouTube watch page =====
    if (!title || !description) {
        try {
            const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en&bpctr=9999999999&has_verified=1`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+478; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiACGgYIgJnPpwY'
                }
            });
            if (pageResponse.ok) {
                const html = await pageResponse.text();
                
                // Extract ytInitialPlayerResponse using brace counting
                const playerData = extractJsonVar(html, 'ytInitialPlayerResponse');
                if (playerData && playerData.videoDetails) {
                    if (!title) title = playerData.videoDetails.title || '';
                    if (!description) description = playerData.videoDetails.shortDescription || '';
                }

                // Try og:description meta tag
                if (!description) {
                    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
                    if (descMatch) description = descMatch[1];
                }
                if (!title) {
                    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
                    if (titleMatch) title = titleMatch[1];
                }
            }
        } catch (error) {
            console.error('Watch page scrape error:', error.message);
        }
    }

    // ===== METHOD 3: InnerTube API =====
    if (!title || !description) {
        try {
            const response = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Origin': 'https://www.youtube.com',
                    'Referer': 'https://www.youtube.com/'
                },
                body: JSON.stringify({
                    context: {
                        client: {
                            clientName: 'WEB',
                            clientVersion: '2.20241201.00.00',
                            hl: 'en',
                            gl: 'US'
                        }
                    },
                    videoId: videoId
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.videoDetails) {
                    if (!title) title = data.videoDetails.title || '';
                    if (!description) description = data.videoDetails.shortDescription || '';
                }
            }
        } catch (error) {
            console.error('InnerTube API error:', error.message);
        }
    }

    // ===== METHOD 4: oEmbed (reliable for title only) =====
    if (!title) {
        try {
            const oembedResponse = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (oembedResponse.ok) {
                const oembedData = await oembedResponse.json();
                if (oembedData && oembedData.title) {
                    title = oembedData.title;
                }
            }
        } catch (error) {
            console.error('oEmbed error:', error.message);
        }
    }

    // Return whatever we have (even if description is empty, title alone is useful)
    if (!title && !description) {
        return new Response(JSON.stringify({ error: 'Failed to extract video info' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
        title: unescapeHtml(title),
        description: unescapeHtml(description)
    }), { headers: corsHeaders });
}

// Extract a top-level JSON object from HTML by variable name
// Uses brace-counting instead of regex for reliability
function extractJsonVar(html, varName) {
    const marker = `var ${varName}`;
    let idx = html.indexOf(marker);
    if (idx === -1) return null;

    idx += marker.length;
    while (idx < html.length && (html[idx] === ' ' || html[idx] === '=')) idx++;
    if (idx >= html.length || html[idx] !== '{') return null;

    const jsonStart = idx;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = jsonStart; i < html.length; i++) {
        const ch = html[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (!inString) {
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    try { return JSON.parse(html.substring(jsonStart, i + 1)); }
                    catch (e) { return null; }
                }
            }
        }
    }
    return null;
}
