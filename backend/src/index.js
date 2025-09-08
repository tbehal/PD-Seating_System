const express = require('express');
const cors = require('cors');
const config = require('./config');
const availabilityRouter = require('./routes/availability');
const { watchFile } = require('./watch');

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/availability', availabilityRouter);

// For Vercel serverless
if (process.env.NODE_ENV === 'production') {
    module.exports = app;
} else {
    app.listen(config.port, () => {
        console.log(`Scheduler backend listening on ${config.port}`);
        try { watchFile(); } catch (e) { console.warn('Watch disabled', e.message); }
    });
}