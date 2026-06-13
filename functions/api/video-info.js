export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl || (!targetUrl.includes('youtube.com/') && !targetUrl.includes('youtu.be/'))) {
        return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const videoIdMatch = targetUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?/\s]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (!videoId) {
        return new Response(JSON.stringify({ error: 'Video ID not found' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

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

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        let title = '';
        let description = '';

        if (data && data.videoDetails) {
            title = data.videoDetails.title || '';
            description = data.videoDetails.shortDescription || '';
        }

        return new Response(JSON.stringify({ title, description }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('Error fetching video info:', error.message);
        return new Response(JSON.stringify({ error: 'Failed to extract video info' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
