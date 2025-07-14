const mongoose = require('mongoose');

async function connectDB() {
    try {
        const uri = process.env.DB_URL;
        const dbName = process.env.DB_NAME || 'clips';
        
        if (!uri) {
            throw new Error('DB_URL environment variable is not defined.');
        }

        await mongoose.connect(uri, {
            dbName: dbName,
        });
        console.log(`Connected to MongoDB database: ${mongoose.connection.db.databaseName}`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

module.exports = connectDB; 