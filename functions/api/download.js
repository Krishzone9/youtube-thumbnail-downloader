export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const filename = url.searchParams.get('filename') || 'download.jpg';

    if (!targetUrl) return new Response('URL is required', { status: 400 });

    try {
        const imageRes = await fetch(targetUrl);
        
        if (!imageRes.ok) {
            return new Response('Error downloading image', { status: imageRes.status });
        }

        const newHeaders = new Headers();
        newHeaders.set('Content-Disposition', `attachment; filename="${filename}"`);
        newHeaders.set('Content-Type', 'image/jpeg');
        newHeaders.set('Cache-Control', 'public, max-age=86400');

        return new Response(imageRes.body, {
            status: imageRes.status,
            headers: newHeaders
        });
    } catch (err) {
        console.error('Download error:', err.message);
        return new Response('Error downloading image', { status: 500 });
    }
}
