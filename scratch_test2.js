async function test() {
    const res = await fetch('https://www.youtube.com/watch?v=5qap5aO4i9A');
    const html = await res.text();
    const title = html.match(/<meta property="og:title" content="(.*?)">/)?.[1];
    const desc = html.match(/<meta property="og:description" content="(.*?)">/)?.[1] || html.match(/<meta name="description" content="(.*?)">/)?.[1];
    console.log('Title:', title);
    console.log('Description:', desc ? desc.substring(0, 100) + '...' : 'none');
}

test();
