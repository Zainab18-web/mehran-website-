// === FIREBASE DATABASE CONNECTION & SETUP ===
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";

// TODO: Aapne yahan apni Firebase Config details dalni hain!
// Jab aap Firebase me naya project banayenge, tou "Web App" add karne ke baad ye keys milengi:
export const firebaseConfig = {
  apiKey: "AIzaSyD160sN2V6T_mom9Sz3Fqb7xWoGr81x8rc",
  authDomain: "mgiad-3d6eb.firebaseapp.com",
  databaseURL: "https://mgiad-3d6eb-default-rtdb.firebaseio.com",
  projectId: "mgiad-3d6eb",
  storageBucket: "mgiad-3d6eb.firebasestorage.app",
  messagingSenderId: "868908012353",
  appId: "1:868908012353:web:01411629d9b7c366ccc7c0",
  measurementId: "G-5VZPNBZYL3"
};

let database = null;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        const app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        console.log("🔥 Firebase Database Successfully Connected!");
    } else {
        console.warn("⚠️ Firebase is not configured yet. Pura real-time chalane ke liye firebaseConfig update karein.");
    }
} catch(e) {
    console.error("Firebase connection error:", e);
}

// Global functions so script.js can use them
window.isFirebaseActive = () => database !== null;

window.saveWebsiteReviewToFirebase = (reviewObj) => {
    if (!database) return;
    const dbRef = ref(database, 'websiteReviews');
    const newRef = push(dbRef);
    set(newRef, reviewObj);
};

window.saveProductReviewToFirebase = (productId, reviewObj) => {
    if (!database) return;
    const dbRef = ref(database, `productReviews/${productId}`);
    const newRef = push(dbRef);
    set(newRef, reviewObj);
};

window.listenToFirebaseData = () => {
    if (!database) return;

    // 1. Website Reviews Real-Time Sync
    onValue(ref(database, 'websiteReviews'), (snapshot) => {
        const data = snapshot.val();
        if (data && typeof window.updateWebsiteReviewsFromFirebase === 'function') {
            const reviewsArray = Object.values(data);
            window.updateWebsiteReviewsFromFirebase(reviewsArray);
        }
    });

    // 2. Product Reviews Real-Time Sync
    onValue(ref(database, 'productReviews'), (snapshot) => {
        const data = snapshot.val();
        if (data && typeof window.updateProductReviewsFromFirebase === 'function') {
            window.updateProductReviewsFromFirebase(data);
        }
    });
};

// Start listening if active
setTimeout(() => {
    window.listenToFirebaseData();
}, 1000);
