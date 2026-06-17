export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const filename = url.searchParams.get('filename') || 'download.jpg';

    if (!targetUrl) return new Response('URL is required', { status: 400 });

    // SECURITY: Only allow YouTube image domains (prevents SSRF attacks)
    try {
        const parsedUrl = new URL(targetUrl);
        const allowedHosts = ['i.ytimg.com', 'yt3.ggpht.com', 'yt3.googleusercontent.com', 'lh3.googleusercontent.com'];
        if (!allowedHosts.some(host => parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host))) {
            return new Response('Forbidden: only YouTube image URLs are allowed', { status: 403 });
        }
    } catch (e) {
        return new Response('Invalid URL', { status: 400 });
    }

    // SECURITY: Sanitize filename to prevent header injection
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);

    try {
        const imageRes = await fetch(targetUrl);
        
        if (!imageRes.ok) {
            return new Response('Error downloading image', { status: imageRes.status });
        }

        const newHeaders = new Headers();
        newHeaders.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
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
