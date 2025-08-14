const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Set Google credentials dynamically
if (process.env.GCP_SERVICE_ACCOUNT_PATH) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.env.GCP_SERVICE_ACCOUNT_PATH);
}

const logger = require('./utils/logger');
const connectDB = require('./db');
const mainRoutes = require('./routes/index');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'https://vinci-clips-frontend-382403086889.uc.r.appspot.com'],
    credentials: true,
    exposedHeaders: ['Content-Length', 'X-Content-Length']
}));
app.use(express.json());

// Add request logging middleware
app.use(logger.requestMiddleware);

// Mount routes
app.use('/clips', mainRoutes);

async function startServer() {
    try {
        await connectDB();
        app.listen(port, () => {
            logger.info(`Server started successfully on port ${port}`);
        });
    } catch (error) {
        logger.logError(error, { context: 'server_startup' });
        process.exit(1);
    }
}

startServer(); 