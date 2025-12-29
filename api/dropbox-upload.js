const https = require('https');

const CLIENT_MAP = {
    'AnnasWorld01': '/Anna',
    'TessasPassword': '/Tessa'
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    try {
        const busboy = require('busboy');
        const bb = busboy({ headers: req.headers });
        let fields = {};
        let fileBuffer = null;
        let fileName = '';
        
        await new Promise((resolve, reject) => {
            bb.on('field', (name, val) => { fields[name] = val; });
            bb.on('file', (name, file, info) => {
                fileName = info.filename;
                const chunks = [];
                file.on('data', (data) => chunks.push(data));
                file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
            });
            bb.on('close', resolve);
            bb.on('error', reject);
            req.pipe(bb);
        });
        
        const { password, date, trend } = fields;
        const clientFolder = CLIENT_MAP[password];
        if (!clientFolder) return res.status(401).json({ error: 'Ungültiges Passwort' });
        
        const dropboxPath = `${clientFolder}/Reels ${date}/Trend ${trend}/NOT POSTED YET/${fileName}`;
        const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
        
        const uploadResult = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'content.dropboxapi.com',
                path: '/2/files/upload',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'add', autorename: true, mute: false }),
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': fileBuffer.length
                }
            };
            const request = https.request(options, (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => {
                    if (response.statusCode === 200) resolve(JSON.parse(data));
                    else reject(new Error(data));
                });
            });
            request.on('error', reject);
            request.write(fileBuffer);
            request.end();
        });
        
        res.status(200).json({ success: true, path: uploadResult.path_display });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
