const { MongoClient } = require('mongodb');

const uri = process.env.DB_URL;
const dbName = process.env.DB_NAME || 'clips';
const client = new MongoClient(uri);

let db;

async function connectDB() {
  if (db) return db;
  await client.connect();
  db = client.db(dbName);
  console.log(`Connected to MongoDB database: ${dbName}`);
  return db;
}

module.exports = connectDB; 