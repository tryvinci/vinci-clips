# 🛠️ Installation Guide - Vinci Clips

This guide provides instructions for setting up and running the Vinci Clips application in a local development environment.

## 📋 Prerequisites

### System Requirements
- **Node.js**: v18.0.0 or later
- **npm**: v8.0.0 or later
- **FFmpeg**: This is a critical dependency for all video and audio processing.
- **Git**: For cloning the repository.

### API Keys
- **Gemini API**: The application uses the Gemini API for all transcription and AI analysis features. You will need to obtain an API key from [Google AI Studio](https://aistudio.google.com/).

---

## 🚀 Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/tryvinci/vinci-clips.git
cd vinci-clips
```

### 2. Install Dependencies
The project is split into a `backend` and a `frontend`, and you need to install the dependencies for both.

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Configure Environment Variables
The backend requires an environment file to store your API key.

```bash
# Navigate to the backend directory
cd backend

# Copy the example .env file
cp .env.example .env
```

```bash
# Navigate to the frontend directory
cd frontend

# Copy the example .env file
cp env.example .env.local
```




Now, open the newly created `.env` file in a text editor and add your Gemini API key:

```env
# .env
GEMINI_API_KEY=your-gemini-api-key-here
```

### 4. Start the Application
To run the app concurrently

**You first have to install concurrently**
```bash
# Start the frontend and the backend server
npm install concurrently --save-dev

#global installation
npm install -g concurrently
```

**In your first terminal (from the project root):**
```bash
npm start
```




You can also run the backend and frontend in separate terminal windows.

**In your first terminal (from the project root):**
```bash
npm run start:backend
```

**In your second terminal (from the project root):**
```bash
npm run start:frontend
```

Once both are running, you can access the application at `http://localhost:3000/upload`.

---

