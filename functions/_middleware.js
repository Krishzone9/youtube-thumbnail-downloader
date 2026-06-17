// Middleware: Block search engine crawlers on the *.pages.dev domain
// while keeping the main domain (solidsmm.in) fully indexable
export async function onRequest(context) {
    const response = await context.next();
    const url = new URL(context.request.url);

    // Only add noindex header for the pages.dev domain
    if (url.hostname.endsWith('.pages.dev')) {
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return newResponse;
    }

    return response;
}
