// MongoDB initialization script for Vinci Clips
// This script runs when the MongoDB container is first created

// Switch to the vinci-clips database
db = db.getSiblingDB('vinci-clips');

// Create collections with initial indexes for better performance
db.createCollection('transcripts');
db.createCollection('clips');
db.createCollection('users');

// Add indexes for common queries
db.transcripts.createIndex({ "status": 1 });
db.transcripts.createIndex({ "createdAt": -1 });
db.transcripts.createIndex({ "originalName": "text" });

db.clips.createIndex({ "transcriptId": 1 });
db.clips.createIndex({ "createdAt": -1 });

// Create initial admin user (optional)
// Uncomment if you want to create a default user
/*
db.users.insertOne({
  username: "admin",
  email: "admin@vinci-clips.local",
  role: "admin",
  createdAt: new Date()
});
*/

print("MongoDB initialization completed for Vinci Clips");
print("Database: vinci-clips");
print("Collections created: transcripts, clips, users");
print("Indexes created for performance optimization");