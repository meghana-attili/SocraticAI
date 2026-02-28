import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { latex, title } = await request.json();

        if (!latex && !title) {
            return NextResponse.json({ error: 'No query provided' }, { status: 400 });
        }

        // Build search query for equation visualizations
        const query = `${title || ''} ${latex || ''} math visualization`.trim();
        const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;

        // Fetch Google Images page server-side
        const res = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        const html = await res.text();

        // Extract image URLs from Google Images HTML
        // Google embeds image source URLs in data attributes and script tags
        const images = [];

        // Method 1: Extract from img tags with src starting with http
        const imgRegex = /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp)[^"]*)",\s*\d+,\s*\d+\]/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null && images.length < 6) {
            const url = match[1];
            // Skip Google's own assets and tiny thumbnails
            if (!url.includes('gstatic.com') && !url.includes('google.com') && !url.includes('googleapis.com')) {
                images.push(url);
            }
        }

        // Method 2: Fallback - extract from data-src or src attributes
        if (images.length === 0) {
            const srcRegex = /(?:data-src|src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp)[^"]*)"/gi;
            while ((match = srcRegex.exec(html)) !== null && images.length < 6) {
                const url = match[1];
                if (!url.includes('gstatic.com') && !url.includes('google.com')) {
                    images.push(url);
                }
            }
        }

        // Method 3: Extract base64 thumbnails from Google's inline data
        if (images.length === 0) {
            const b64Regex = /data:image\/(?:jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]{100,}/g;
            while ((match = b64Regex.exec(html)) !== null && images.length < 3) {
                images.push(match[0]);
            }
        }

        // Deduplicate
        const unique = [...new Set(images)];

        return NextResponse.json({
            images: unique,
            query,
            searchUrl,
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
