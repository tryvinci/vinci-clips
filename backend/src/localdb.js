const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '..', 'storage', 'db.json');

function readDb() {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({ transcripts: [] }));
    }
    const data = fs.readFileSync(dbPath);
    return JSON.parse(data);
}

function writeDb(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

const Transcript = {
    find: async (query = {}) => {
        const db = readDb();
        // Simple query handling, can be expanded
        return db.transcripts.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : 0;
            const dateB = b.createdAt ? new Date(b.createdAt) : 0;
            return dateB - dateA;
        });
    },

    findById: async (id) => {
        const db = readDb();
        return db.transcripts.find(t => t._id === id);
    },

    create: async (data) => {
        const db = readDb();
        const newTranscript = { ...data, _id: uuidv4(), createdAt: new Date().toISOString() };
        db.transcripts.push(newTranscript);
        writeDb(db);
        return newTranscript;
    },

    findByIdAndUpdate: async (id, data) => {
        const db = readDb();
        const index = db.transcripts.findIndex(t => t._id === id);
        if (index === -1) return null;
        db.transcripts[index] = { ...db.transcripts[index], ...data };
        writeDb(db);
        return db.transcripts[index];
    },

    findByIdAndDelete: async (id) => {
        const db = readDb();
        const index = db.transcripts.findIndex(t => t._id === id);
        if (index === -1) return null;
        const deleted = db.transcripts.splice(index, 1);
        writeDb(db);
        return deleted[0];
    },
    
    // Add a save method to mimic Mongoose instances
    save: async function() {
        return Transcript.findByIdAndUpdate(this._id, this);
    }
};

// Helper to create a new transcript object with a save method
const newTranscript = (data) => {
    const instance = { ...data, _id: uuidv4(), createdAt: new Date().toISOString() };
    instance.save = async function() {
        const db = readDb();
        const index = db.transcripts.findIndex(t => t._id === this._id);
        if (index !== -1) {
            db.transcripts[index] = this;
        } else {
            db.transcripts.push(this);
        }
        writeDb(db);
        return this;
    };
    return instance;
};


module.exports = { Transcript, newTranscript };