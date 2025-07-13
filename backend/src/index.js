const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Set Google credentials dynamically
if (process.env.GCP_SERVICE_ACCOUNT_PATH) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, process.env.GCP_SERVICE_ACCOUNT_PATH);
}

const connectDB = require('./db');
const uploadRoutes = require('./routes/upload');
const analyzeRoutes = require('./routes/analyze');
const transcriptsRoutes = require('./routes/transcripts');
const clipsRoutes = require('./routes/clips');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Mount routes
app.use('/clips', uploadRoutes);
app.use('/clips', analyzeRoutes);
app.use('/clips', transcriptsRoutes);
app.use('/clips', clipsRoutes);

async function startServer() {
    try {
        await connectDB();
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Failed to connect to the database', error);
        process.exit(1);
    }
}

startServer(); 