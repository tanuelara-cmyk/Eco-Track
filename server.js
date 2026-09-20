import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Expose runtime Firebase configuration from environment variables if set
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC-ikOKZ7gzeLJp9bWdP-mwYZlU_ejs2Ak",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0947402564.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0947402564",
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-ecotrack-7f5d6f64-3092-4885-804b-ad7f56607570",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0947402564.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "428097366673",
    appId: process.env.FIREBASE_APP_ID || "1:428097366673:web:b169c1a4ac33b6f7bc2d30"
  });
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EcoTrack server running on http://0.0.0.0:${PORT}`);
});
