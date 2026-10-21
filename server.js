const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Allowed Admin Telegram IDs
const ALLOWED_ADMINS = ['6144546817', '5074717463'];

// In-Memory Database for Episodes & Temporary Session Tokens
const episodesDB = new Map();
const sessionTokens = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Admin Verification Middleware
function verifyAdmin(req, res, next) {
    const adminId = req.headers['x-admin-id'] || req.query.adminId;
    if (!adminId || !ALLOWED_ADMINS.includes(String(adminId))) {
        return res.status(403).json({ success: false, message: "Unauthorized: Access Denied for Admin Panel" });
    }
    next();
}

// 2. Add Episode API (Admin Only)
app.post('/api/admin/add-episode', verifyAdmin, (req, res) => {
    const { animeName, epNumber, epTitle, videoUrl } = req.body;

    if (!animeName || !epNumber || !videoUrl) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const episodeId = `ep_${Date.now()}`;
    const episodeData = {
        id: episodeId,
        animeName,
        epNumber,
        epTitle: epTitle || `Episode ${epNumber}`,
        videoUrl,
        createdAt: new Date().toISOString()
    };

    episodesDB.set(episodeId, episodeData);

    res.json({
        success: true,
        message: "Episode published successfully!",
        episodeId: episodeId,
        streamPath: `/watch.html?id=${episodeId}`
    });
});

// 3. Generate Temporary Token for Bot Stream Links
app.get('/api/get-watch-token', (req, res) => {
    const { episodeId, userId } = req.query;

    if (!episodeId || !episodesDB.has(episodeId)) {
        return res.status(404).json({ success: false, message: "Episode not found" });
    }

    // Single-use token valid for streaming
    const token = `token_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    
    // Token valid for 5 minutes
    sessionTokens.set(token, {
        episodeId,
        userId: userId || 'Anonymous',
        expiresAt: Date.now() + 5 * 60 * 1000
    });

    res.json({ success: true, token });
});

// 4. Fetch Episode Data for Player
app.get('/api/get-episode-data', (req, res) => {
    const { episodeId, token } = req.query;

    if (!episodeId || !episodesDB.has(episodeId)) {
        return res.status(404).json({ success: false, message: "Episode not found" });
    }

    // Token Validation
    if (!token || !sessionTokens.has(token)) {
        return res.status(403).json({ success: false, message: "Invalid or Expired Link" });
    }

    const tokenData = sessionTokens.get(token);
    if (Date.now() > tokenData.expiresAt) {
        sessionTokens.delete(token);
        return res.status(403).json({ success: false, message: "Streaming Session Expired" });
    }

    const episode = episodesDB.get(episodeId);

    res.json({
        success: true,
        animeName: episode.animeName,
        epNumber: episode.epNumber,
        epTitle: episode.epTitle,
        videoUrl: episode.videoUrl,
        viewerId: tokenData.userId
    });
});

// Routes for HTML
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/watch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'watch.html'));
});

app.listen(PORT, () => {
    console.log(`ZK Dubbing Web Server running on port ${PORT}`);
});
