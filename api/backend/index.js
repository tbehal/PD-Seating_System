const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const availabilityRouter = require('./routes/availability');
const { watchFile } = require('./watch');

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/availability', availabilityRouter);

// In local development, also serve the built frontend from the project root
if (process.env.NODE_ENV !== 'production') {
    const projectRoot = path.join(__dirname, '..', '..');
    app.use(express.static(projectRoot));

    // SPA fallback: send index.html for non-API routes
    app.get(/^(?!\/api\/).*/, (req, res) => {
        res.sendFile(path.join(projectRoot, 'index.html'));
    });
}

// For Vercel serverless
if (process.env.NODE_ENV === 'production') {
    module.exports = app;
} else {
    app.listen(config.port, () => {
        console.log(`Scheduler backend listening on ${config.port}`);
        try { watchFile(); } catch (e) { console.warn('Watch disabled', e.message); }
    });
}