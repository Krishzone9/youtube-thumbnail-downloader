export async function onRequestGet(context) {
    const { request } = context;
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

    // --- Utility: extract a top-level JSON object from HTML by variable name ---
    // Uses brace-counting instead of regex so it handles nested braces correctly
    function extractJsonVar(html, varName) {
        const marker = `var ${varName}`;
        let idx = html.indexOf(marker);
        if (idx === -1) return null;

        // Move past the marker and any whitespace/equals sign to reach the opening brace
        idx += marker.length;
        while (idx < html.length && (html[idx] === ' ' || html[idx] === '=')) idx++;
        if (html[idx] !== '{') return null;

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

    // --- Helper: extract title & description from a YouTube HTML page ---
    function extractFromHtml(html) {
        let t = '';
        let d = '';

        // 1. Try ytInitialPlayerResponse (best source for full description)
        const playerData = extractJsonVar(html, 'ytInitialPlayerResponse');
        if (playerData && playerData.videoDetails) {
            t = playerData.videoDetails.title || '';
            d = playerData.videoDetails.shortDescription || '';
        }

        // 2. If description is still empty, try ytInitialData
        if (!d) {
            const initialData = extractJsonVar(html, 'ytInitialData');
            if (initialData) {
                try {
                    // Description lives deep inside: contents.twoColumnWatchNextResults.results.results.contents[1].videoSecondaryInfoRenderer.attributedDescription.content
                    const contents = initialData?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
                    if (Array.isArray(contents)) {
                        for (const item of contents) {
                            const renderer = item.videoSecondaryInfoRenderer;
                            if (renderer) {
                                d = renderer?.attributedDescription?.content || renderer?.description?.simpleText || '';
                                if (d) break;
                                // Also try description runs
                                if (renderer?.description?.runs) {
                                    d = renderer.description.runs.map(r => r.text).join('');
                                }
                                if (d) break;
                            }
                        }
                    }
                } catch (e) { /* ignore parse errors in ytInitialData */ }
            }
        }

        // 3. If title is still empty, try meta tags
        if (!t) {
            const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
                               html.match(/<meta\s+name="title"\s+content="([^"]*)"/i);
            if (titleMatch) t = titleMatch[1];
        }

        // 4. If description is still empty, try meta tags (truncated but better than nothing)
        if (!d) {
            const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) ||
                              html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
            if (descMatch) d = descMatch[1];
        }

        // 5. Try JSON-LD structured data
        if (!d) {
            const ldMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
            if (ldMatch) {
                try {
                    const ldArr = JSON.parse(ldMatch[1]);
                    const ldData = Array.isArray(ldArr) ? ldArr[0] : ldArr;
                    if (ldData.description) d = ldData.description;
                    if (!t && ldData.name) t = ldData.name;
                } catch (e) { /* ignore */ }
            }
        }

        return { title: t, description: d };
    }

    // ===== METHOD 1: Fetch YouTube watch page (desktop) =====
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
            const result = extractFromHtml(html);
            if (result.title) title = result.title;
            if (result.description) description = result.description;
        }
    } catch (error) {
        console.error('Method 1 (desktop page) error:', error.message);
    }

    // ===== METHOD 2: Fetch mobile YouTube page (often less restricted) =====
    if (!description) {
        try {
            const mobileResponse = await fetch(`https://m.youtube.com/watch?v=${videoId}&hl=en`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+478'
                }
            });
            if (mobileResponse.ok) {
                const html = await mobileResponse.text();
                const result = extractFromHtml(html);
                if (!title && result.title) title = result.title;
                if (result.description) description = result.description;
            }
        } catch (error) {
            console.error('Method 2 (mobile page) error:', error.message);
        }
    }

    // ===== METHOD 3: YouTube embed page (designed for 3rd party, less restricted) =====
    if (!description) {
        try {
            const embedResponse = await fetch(`https://www.youtube.com/embed/${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': 'text/html',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            if (embedResponse.ok) {
                const html = await embedResponse.text();
                const playerData = extractJsonVar(html, 'ytInitialPlayerResponse');
                if (playerData && playerData.videoDetails) {
                    if (!title) title = playerData.videoDetails.title || '';
                    if (playerData.videoDetails.shortDescription) {
                        description = playerData.videoDetails.shortDescription;
                    }
                }
            }
        } catch (error) {
            console.error('Method 3 (embed page) error:', error.message);
        }
    }

    // ===== METHOD 4: InnerTube API (WEB client) =====
    if (!description) {
        try {
            const response = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'X-YouTube-Client-Name': '1',
                    'X-YouTube-Client-Version': '2.20241201.00.00',
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
                    if (data.videoDetails.shortDescription) {
                        description = data.videoDetails.shortDescription;
                    }
                }
            }
        } catch (error) {
            console.error('Method 4 (InnerTube API) error:', error.message);
        }
    }

    // ===== METHOD 5: oEmbed API (reliable for title, no description) =====
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
            console.error('Method 5 (oEmbed) error:', error.message);
        }
    }

    if (!title && !description) {
        return new Response(JSON.stringify({ error: 'Failed to extract video info' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
        title: unescapeHtml(title),
        description: unescapeHtml(description)
    }), { headers: corsHeaders });
}
