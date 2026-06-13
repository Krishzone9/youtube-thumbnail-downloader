export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl || (!targetUrl.includes('youtube.com/') && !targetUrl.includes('youtu.be/'))) {
        return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const fetchWithRetry = async (urlToFetch, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(urlToFetch, {
                    headers: {
                        'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+478'
                    }
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await response.text();
            } catch (e) {
                if (i === retries - 1) throw e;
            }
        }
    };

    try {
        const html = await fetchWithRetry(targetUrl);
        
        let profileUrl = null;
        let bannerUrl = null;
        let channelName = '';
        let channelDescription = '';

        const ytInitialDataMatch = html.match(/var ytInitialData = (\{.*?\});/);
        
        if (ytInitialDataMatch) {
            const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
            const header = ytInitialData.header;
            const metadata = ytInitialData.metadata;

            if (metadata && metadata.channelMetadataRenderer) {
                channelName = metadata.channelMetadataRenderer.title || '';
                channelDescription = metadata.channelMetadataRenderer.description || '';
            }
            
            if (header) {
                const findImageDeep = (obj, targetKeyPart) => {
                    let largestUrl = null;
                    let maxWidth = 0;
                    
                    const search = (o, isTarget) => {
                        if (!o || typeof o !== 'object') return;
                        
                        if (isTarget) {
                            const arr = o.thumbnails || o.sources;
                            if (Array.isArray(arr)) {
                                arr.forEach(img => {
                                    if (img.url && img.width > maxWidth) {
                                        maxWidth = img.width;
                                        largestUrl = img.url;
                                    }
                                });
                            }
                        }
                        
                        for (let k in o) {
                            search(o[k], isTarget || k.toLowerCase().includes(targetKeyPart));
                        }
                    };
                    
                    search(header, false);
                    return largestUrl;
                };

                profileUrl = findImageDeep(header, 'avatar');
                bannerUrl = findImageDeep(header, 'banner');
            }
        }

        if (!profileUrl) {
            const metaMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
            if (metaMatch) profileUrl = metaMatch[1];
        }

        return new Response(JSON.stringify({ profileUrl, bannerUrl, channelName, channelDescription }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching channel data:', error.message);
        return new Response(JSON.stringify({ error: 'Failed to extract channel data' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
