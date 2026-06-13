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
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'en-US,en;q=0.9'
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
        
        let title = '';
        let description = '';

        const playerResponseMatch = html.match(/var ytInitialPlayerResponse = (\{.*?\});/);
        
        if (playerResponseMatch) {
            try {
                const playerResponse = JSON.parse(playerResponseMatch[1]);
                title = playerResponse.videoDetails.title || '';
                description = playerResponse.videoDetails.shortDescription || '';
            } catch (e) {}
        } else {
            const titleMatch = html.match(/<meta name="title" content="([^"]+)">/);
            if (titleMatch) title = titleMatch[1];
            
            const descMatch = html.match(/<meta name="description" content="([^"]+)">/);
            if (descMatch) description = descMatch[1];
        }

        return new Response(JSON.stringify({ title, description }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching video info:', error.message);
        return new Response(JSON.stringify({ error: 'Failed to extract video info' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
