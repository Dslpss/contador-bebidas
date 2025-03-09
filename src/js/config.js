// Configuração Firebase com fallback para valores fixos caso as variáveis de ambiente não funcionem
export const firebaseConfig = {
  apiKey:
    process.env.FIREBASE_API_KEY || "AIzaSyAd5b-HeFZLl83BhjSqy8Ysd4RLbH1CNSs",
  authDomain:
    process.env.FIREBASE_AUTH_DOMAIN || "contador-de-bebidas.firebaseapp.com",
  databaseURL:
    process.env.FIREBASE_DATABASE_URL ||
    "https://contador-de-bebidas-default-rtdb.firebaseio.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "contador-de-bebidas",
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    "contador-de-bebidas.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "75591051433",
  appId:
    process.env.FIREBASE_APP_ID || "1:75591051433:web:23ec4f134d958e013f21b8",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-9CY38TMXCM",
};
