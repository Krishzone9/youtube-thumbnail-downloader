export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) return new Response('URL is required', { status: 400 });

    if (!targetUrl.includes('ytimg.com') && !targetUrl.includes('googleusercontent.com')) {
        return new Response('Invalid image source', { status: 400 });
    }

    try {
        const imageRes = await fetch(targetUrl);
        
        if (!imageRes.ok) {
            return new Response('Error proxying image', { status: imageRes.status });
        }

        const newHeaders = new Headers(imageRes.headers);
        newHeaders.set('Content-Type', 'image/jpeg');
        newHeaders.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

        return new Response(imageRes.body, {
            status: imageRes.status,
            headers: newHeaders
        });
    } catch (err) {
        console.error('Proxy error:', err.message);
        return new Response('Error proxying image', { status: 500 });
    }
}
