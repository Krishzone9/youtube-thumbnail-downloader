export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl || (!targetUrl.includes('youtube.com/') && !targetUrl.includes('youtu.be/'))) {
        return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const videoIdMatch = targetUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([^&?/\s]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
        return new Response(JSON.stringify({ error: 'Video ID not found' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let title = '';
    let description = '';

    try {
        const response = await fetch('https://www.youtube.com/youtubei/v1/player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20210721.00.00'
                    }
                },
                videoId: videoId
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.videoDetails) {
                title = data.videoDetails.title || '';
                description = data.videoDetails.shortDescription || '';
            }
        }
    } catch (error) {
        console.error('Error fetching video info from player API:', error.message);
    }

    // Fallback: fetch HTML page if title or description is missing
    if (!title || !description) {
        try {
            const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+478'
                }
            });
            if (pageResponse.ok) {
                const html = await pageResponse.text();
                
                // Try extracting from ytInitialPlayerResponse first as it contains the full description
                const playerResponseMatch = html.match(/var ytInitialPlayerResponse = (\{.*?\});/);
                if (playerResponseMatch) {
                    try {
                        const data = JSON.parse(playerResponseMatch[1]);
                        if (!title && data.videoDetails?.title) {
                            title = data.videoDetails.title;
                        }
                        if (!description && data.videoDetails?.shortDescription) {
                            description = data.videoDetails.shortDescription;
                        }
                    } catch (e) {
                        console.error('Error parsing player response from HTML:', e.message);
                    }
                }

                // If still missing, try meta tags
                if (!title) {
                    const titleMatch = html.match(/<meta property="og:title" content="([^"]*)">/) || html.match(/<meta name="title" content="([^"]*)">/);
                    if (titleMatch) title = titleMatch[1];
                }
                if (!description) {
                    const descMatch = html.match(/<meta property="og:description" content="([^"]*)">/) || html.match(/<meta name="description" content="([^"]*)">/);
                    if (descMatch) description = descMatch[1];
                }
            }
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError.message);
        }
    }

    // Final Fallback for title: oEmbed API (Does not block server IPs)
    if (!title) {
        try {
            const oembedResponse = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (oembedResponse.ok) {
                const oembedData = await oembedResponse.json();
                if (oembedData && oembedData.title) {
                    title = oembedData.title;
                }
            }
        } catch (oembedError) {
            console.error('oEmbed error:', oembedError.message);
        }
    }

    if (!title && !description) {
        return new Response(JSON.stringify({ error: 'Failed to extract video info' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // Unescape HTML entities that might appear in meta tags
    const unescapeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'");
    };

    title = unescapeHtml(title);
    description = unescapeHtml(description);

    return new Response(JSON.stringify({ title, description }), {
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
