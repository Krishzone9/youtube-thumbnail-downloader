async function testHtml(videoId) {
    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+478'
        }
    });
    const html = await pageResponse.text();
    
    let title = '';
    let description = '';
    
    const titleMatch = html.match(/<meta property="og:title" content="([^"]*)">/) || html.match(/<meta name="title" content="([^"]*)">/);
    if (titleMatch) title = titleMatch[1];
    
    const descMatch = html.match(/<meta property="og:description" content="([^"]*)">/) || html.match(/<meta name="description" content="([^"]*)">/);
    if (descMatch) description = descMatch[1];

    console.log("HTML Title:", title);
    console.log("HTML Desc:", description ? description.substring(0, 50) : "Not found");

    // Let's also try to find ytInitialPlayerResponse
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse = (\{.*?\});/);
    if (playerResponseMatch) {
        try {
            const data = JSON.parse(playerResponseMatch[1]);
            console.log("PlayerResponse Desc:", data.videoDetails?.shortDescription?.substring(0, 50) || "Not found");
        } catch (e) {
            console.log("Error parsing player response");
        }
    }
}

testHtml('dQw4w9WgXcQ');
