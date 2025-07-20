const ytdl = require('@distube/ytdl-core');

async function testYouTube() {
    const url = 'https://www.youtube.com/watch?v=Et6JJM2z_aA';
    
    try {
        console.log('Getting video info...');
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;
        
        console.log('Title:', videoDetails.title);
        console.log('Duration:', videoDetails.lengthSeconds, 'seconds');
        console.log('Available formats:', info.formats.length);
        
        // Check for formats with audio and video
        const audioVideoFormats = info.formats.filter(f => f.hasAudio && f.hasVideo);
        console.log('Formats with audio+video:', audioVideoFormats.length);
        
        if (audioVideoFormats.length > 0) {
            const format = audioVideoFormats.sort((a, b) => b.bitrate - a.bitrate)[0];
            console.log('Best audio+video format:');
            console.log('  Quality:', format.qualityLabel);
            console.log('  Bitrate:', format.bitrate);
            console.log('  Has Audio:', format.hasAudio);
            console.log('  Has Video:', format.hasVideo);
            console.log('  URL length:', format.url?.length || 'no url');
        } else {
            console.log('No combined audio+video formats available');
            
            const audioFormats = info.formats.filter(f => f.hasAudio);
            const videoFormats = info.formats.filter(f => f.hasVideo);
            
            console.log('Audio-only formats:', audioFormats.length);
            console.log('Video-only formats:', videoFormats.length);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testYouTube();