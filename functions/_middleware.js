// Middleware: Security headers + block crawlers on pages.dev domain
export async function onRequest(context) {
    const response = await context.next();
    const url = new URL(context.request.url);
    const newResponse = new Response(response.body, response);

    // --- Block crawlers on pages.dev domain only ---
    if (url.hostname.endsWith('.pages.dev')) {
        newResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // --- Security Headers (all domains) ---
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');

    // --- Cache Headers for Static Assets ---
    if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.match(/\.(svg|png|jpg|jpeg|gif|ico)$/i)) {
        newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return newResponse;
}
