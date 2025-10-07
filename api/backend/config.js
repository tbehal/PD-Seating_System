require('dotenv').config();
const path = require('path');

const config = {
    port: process.env.PORT || 5001,
    cacheDriver: (process.env.CACHE_DRIVER || 'node').toLowerCase(),
    cacheTTL: Number(process.env.CACHE_TTL_SECONDS || 3600),
    localExcelPath: process.env.LOCAL_EXCEL_PATH || path.join(__dirname, '..', 'data', 'Test.xlsx'),
    useGraph: (process.env.USE_GRAPH || 'false').toLowerCase() === 'true' && process.env.NODE_ENV === 'production',
    graph: {
        token: process.env.GRAPH_ACCESS_TOKEN || '',
        driveId: process.env.GRAPH_DRIVE_ID || '',
        itemId: process.env.GRAPH_ITEM_ID || '',
        downloadUrl: process.env.GRAPH_DOWNLOAD_URL || '',
        clientId: process.env.GRAPH_CLIENT_ID || '',
        clientSecret: process.env.GRAPH_CLIENT_SECRET || '',
        tenantId: process.env.GRAPH_TENANT_ID || '',
        scopes: process.env.GRAPH_SCOPES || 'https://graph.microsoft.com/.default',
        useOauth: (process.env.GRAPH_USE_OAUTH || 'false').toLowerCase() === 'true'
    },
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
};

module.exports = config;