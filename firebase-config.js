// ==============================================================================
// EcoTrack - Firebase Configuration & Services
// ==============================================================================
// Place this file in the root directory: /firebase-config.js
// Replace the placeholder values below with your Firebase Project credentials
// from Firebase Console > Project Settings > General > "Your apps" (Web app).
// ==============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ==============================================================================
// AUTHORIZED ADMINISTRATOR CONFIGURATION
// ==============================================================================
export const ADMIN_EMAIL = "tanu.elara@gmail.com";

// Firebase project credentials provisioned by Google Cloud
const defaultFirebaseConfig = {
    apiKey: "AIzaSyC-ikOKZ7gzeLJp9bWdP-mwYZlU_ejs2Ak",
    authDomain: "gen-lang-client-0947402564.firebaseapp.com",
    projectId: "gen-lang-client-0947402564",
    firestoreDatabaseId: "ai-studio-ecotrack-7f5d6f64-3092-4885-804b-ad7f56607570",
    storageBucket: "gen-lang-client-0947402564.firebasestorage.app",
    messagingSenderId: "428097366673",
    appId: "1:428097366673:web:b169c1a4ac33b6f7bc2d30"
};

export const firebaseConfig = (typeof window !== "undefined" && window.__FIREBASE_CONFIG__)
    ? { ...defaultFirebaseConfig, ...window.__FIREBASE_CONFIG__ }
    : defaultFirebaseConfig;

// Check if credentials are valid
export const isFirebaseConfigured = () => {
    return (
        Boolean(firebaseConfig.apiKey) &&
        firebaseConfig.apiKey !== "YOUR_API_KEY" &&
        Boolean(firebaseConfig.projectId) &&
        firebaseConfig.projectId !== "YOUR_PROJECT_ID"
    );
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
export const storage = getStorage(app);

// Attach to window for global availability and backward compatibility across inline scripts
if (typeof window !== "undefined") {
    window.ADMIN_EMAIL = ADMIN_EMAIL;
    window.firebaseConfig = firebaseConfig;
    window.firebaseApp = app;
    window.firebaseAuth = auth;
    window.firebaseDb = db;
}

// Safe diagnostic logging for deployment verification (no secrets/passwords)
console.log("[EcoTrack Diagnostics] Firebase initialized:", {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || "(default)",
    hasApiKey: Boolean(firebaseConfig.apiKey)
});

// ==============================================================================
// AUTHENTICATION SERVICES
// ==============================================================================

/**
 * Register a new user with Email and Password
 * Creates corresponding user document in Firestore with role: 'user', ecoPoints: 0, ecoLevel: 'Eco Starter'
 */
export async function registerUserWithFirebase(name, email, password) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase is not configured yet. Please enter your project keys in firebase-config.js.");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Set display name in Firebase Auth
    await updateProfile(firebaseUser, { displayName: name }).catch(() => {});

    // Create user profile in Firestore
    const isAdmin = email.toLowerCase().trim() === ADMIN_EMAIL;
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userData = {
        uid: firebaseUser.uid,
        userId: firebaseUser.uid,
        name: name,
        email: email.toLowerCase(),
        role: isAdmin ? "admin" : "user",
        ecoPoints: 0,
        ecoLevel: isAdmin ? "Eco Master" : "Eco Starter",
        reportsCount: 0,
        wasteManaged: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    try {
        await setDoc(userDocRef, userData);
    } catch (fsErr) {
        console.warn("Could not save initial user document to Firestore, continuing with auth info:", fsErr);
    }
    return { ...userData, uid: firebaseUser.uid };
}

/**
 * Log in an existing user with Email and Password
 * Retrieves role strictly from Firestore document or admin email verification
 */
export async function loginUserWithFirebase(email, password) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase is not configured yet. Please enter your project keys in firebase-config.js.");
    }

    console.log("[EcoTrack Diagnostics] Authenticating via Firebase signInWithEmailAndPassword for email:", email, "| Project:", firebaseConfig.projectId);
    let userCredential;
    try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (authError) {
        console.warn("[EcoTrack Auth]", {
            code: authError?.code || "unknown",
            message: authError?.message || "Authentication failed"
        });
        throw authError;
    }
    const firebaseUser = userCredential.user;
    console.log("[EcoTrack Diagnostics] Authentication successful for:", firebaseUser.email, "| UID:", firebaseUser.uid, "| Provider:", firebaseUser.providerData?.[0]?.providerId || "password");

    const isAdmin = (firebaseUser.email || email).toLowerCase().trim() === ADMIN_EMAIL;
    const userDocRef = doc(db, "users", firebaseUser.uid);

    try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            const role = isAdmin ? "admin" : (data.role || "user");
            if (isAdmin && data.role !== "admin") {
                await updateDoc(userDocRef, { role: "admin" }).catch(() => {});
            }
            return { ...data, uid: firebaseUser.uid, role };
        } else {
            // Fallback for pre-existing auth users missing a Firestore profile
            const fallbackData = {
                uid: firebaseUser.uid,
                userId: firebaseUser.uid,
                name: firebaseUser.displayName || email.split("@")[0],
                email: email.toLowerCase(),
                role: isAdmin ? "admin" : "user",
                ecoPoints: 0,
                ecoLevel: isAdmin ? "Eco Master" : "Eco Starter",
                reportsCount: 0,
                wasteManaged: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await setDoc(userDocRef, fallbackData).catch(() => {});
            return { ...fallbackData, uid: firebaseUser.uid };
        }
    } catch (firestoreErr) {
        console.warn("Firestore profile fetch/creation failed during login, using authenticated user:", firestoreErr);
        return {
            uid: firebaseUser.uid,
            userId: firebaseUser.uid,
            name: firebaseUser.displayName || email.split("@")[0],
            email: (firebaseUser.email || email).toLowerCase(),
            role: isAdmin ? "admin" : "user",
            ecoPoints: 0,
            ecoLevel: isAdmin ? "Eco Master" : "Eco Starter"
        };
    }
}

/**
 * Sign out current user
 */
export async function logoutUserFromFirebase() {
    if (!isFirebaseConfigured()) return;
    await signOut(auth);
}

/**
 * Sign in or register using Google Authentication popup
 * Newly registered accounts start as 'user' with 0 points
 */
export async function loginWithGoogle() {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase is not configured yet.");
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    const isAdmin = (user.email || "").toLowerCase().trim() === ADMIN_EMAIL;
    // Check if user document already exists in Firestore
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
        const newUserDoc = {
            uid: user.uid,
            userId: user.uid,
            name: user.displayName || (user.email ? user.email.split("@")[0] : "Citizen"),
            email: (user.email || "").toLowerCase(),
            role: isAdmin ? "admin" : "user",
            ecoPoints: 0,
            ecoLevel: isAdmin ? "Eco Master" : "Eco Starter",
            reportsCount: 0,
            wasteManaged: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        await setDoc(userDocRef, newUserDoc);
        return newUserDoc;
    }
    const existingData = docSnap.data();
    const role = isAdmin ? "admin" : (existingData.role || "user");
    if (isAdmin && existingData.role !== "admin") {
        await updateDoc(userDocRef, { role: "admin" }).catch(() => {});
    }
    return { ...existingData, role, uid: user.uid };
}

/**
 * Send password reset email to user
 */
export async function sendPasswordReset(email) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase is not configured yet.");
    }
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
        throw new Error("Please enter your registered email address.");
    }
    await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Fetch current user's profile from Firestore
 */
export async function getUserProfile(uid) {
    if (!isFirebaseConfigured() || !uid) return null;
    try {
        const userDocRef = doc(db, "users", uid);
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) return null;
        const data = docSnap.data();
        const isAdmin = (data.email || "").toLowerCase().trim() === ADMIN_EMAIL;
        if (isAdmin && data.role !== "admin") {
            await updateDoc(userDocRef, { role: "admin" }).catch(() => {});
            return { ...data, role: "admin" };
        }
        return data;
    } catch (err) {
        console.warn("Could not retrieve user document from Firestore, returning basic profile:", err);
        return null;
    }
}

// ==============================================================================
// STORAGE SERVICES
// ==============================================================================

/**
 * Upload waste report image to Firebase Storage or compress client-side as fallback
 * Guaranteed not to exceed Firestore document size limits or crash submission
 */
export async function uploadReportImage(file, userId, reportId) {
    if (!file) return "";
    if (!isFirebaseConfigured()) return "";

    try {
        const cleanFileName = (file.name || "waste_photo.jpg").replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `reports/${userId || "anonymous"}/${reportId || Date.now()}_${Date.now()}_${cleanFileName}`;
        const imageRef = ref(storage, storagePath);

        const metadata = {
            contentType: file.type || "image/jpeg"
        };

        const uploadTask = await uploadBytesResumable(imageRef, file, metadata);
        const downloadURL = await getDownloadURL(uploadTask.ref);
        return downloadURL;
    } catch (storageError) {
        console.warn("Storage upload not available or failed, compressing inline fallback:", storageError);
        // Compress image using HTML canvas so it fits well within Firestore limits (<100KB)
        return new Promise((resolve) => {
            try {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        try {
                            const maxDim = 800;
                            let w = img.width;
                            let h = img.height;
                            if (w > maxDim || h > maxDim) {
                                if (w > h) {
                                    h = Math.round((h * maxDim) / w);
                                    w = maxDim;
                                } else {
                                    w = Math.round((w * maxDim) / h);
                                    h = maxDim;
                                }
                            }
                            const canvas = document.createElement("canvas");
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext("2d");
                            ctx.drawImage(img, 0, 0, w, h);
                            const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.65);
                            resolve(compressedDataUrl);
                        } catch (canvasErr) {
                            console.warn("Canvas compression failed:", canvasErr);
                            resolve("");
                        }
                    };
                    img.onerror = () => resolve("");
                    img.src = e.target.result;
                };
                reader.onerror = () => resolve("");
                reader.readAsDataURL(file);
            } catch (err) {
                console.warn("FileReader failed:", err);
                resolve("");
            }
        });
    }
}

// Helper to reliably extract timestamp in milliseconds from any report format
export function getReportTimestamp(report) {
    if (!report) return 0;
    if (report.createdAt) {
        if (typeof report.createdAt.toMillis === "function") return report.createdAt.toMillis();
        if (report.createdAt.seconds) return report.createdAt.seconds * 1000;
        if (typeof report.createdAt === "number") return report.createdAt;
        const p = Date.parse(report.createdAt);
        if (!isNaN(p)) return p;
    }
    if (report.timestamp) {
        if (typeof report.timestamp.toMillis === "function") return report.timestamp.toMillis();
        if (report.timestamp.seconds) return report.timestamp.seconds * 1000;
        const p = Date.parse(report.timestamp);
        if (!isNaN(p)) return p;
    }
    if (report.date) {
        const p = Date.parse(report.date);
        if (!isNaN(p)) return p;
    }
    return 0;
}

// Helper to reliably extract category from any report format (backward-compatible)
export function getReportCategory(report) {
    if (!report) return "Other";
    return (
        report.category ||
        report.wasteType ||
        report.type ||
        report.complaintType ||
        report.waste_type ||
        "Other"
    );
}

// ==============================================================================
// FIRESTORE REPORT SERVICES
// ==============================================================================

// User-friendly error message translator for Firebase Auth errors
export function getFriendlyAuthErrorMessage(error) {
    if (!error) return "An unknown error occurred.";
    const code = error.code || "";
    const currentDomain = (typeof window !== "undefined" && window.location ? window.location.hostname : "your domain");
    switch (code) {
        case "auth/operation-not-allowed":
            return "Email/Password sign-in is disabled in your Firebase project. Please enable Email/Password provider in Firebase Console > Authentication > Sign-in method, or use 'Continue with Google'.";
        case "auth/unauthorized-domain":
            return `This deployed domain (${currentDomain}) is not authorized in Firebase Authentication. Go to Firebase Console > Authentication > Settings > Authorized domains and add "${currentDomain}".`;
        case "auth/api-key-not-valid.invalid-api-key":
        case "auth/invalid-api-key":
            return "Invalid Firebase API key or HTTP referrer restrictions are blocking this domain in Google Cloud Console.";
        case "auth/email-already-in-use":
            return "This email address is already registered. If this is your account, please log in or click 'Continue with Google'.";
        case "auth/invalid-email":
            return "Please enter a valid email address format (e.g., name@example.com).";
        case "auth/weak-password":
            return "Your password is too weak. Please use at least 6 characters.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
            return "Incorrect email or password. If you originally registered using Google, click 'Continue with Google'. If you forgot your password, you can reset it.";
        case "auth/popup-blocked":
            return "Popup was blocked by your browser. Please allow popups or open the app in a new tab.";
        case "auth/user-disabled":
            return "This account has been disabled. Please contact support.";
        case "auth/too-many-requests":
            return "Too many failed attempts. Please wait a few moments before trying again, or reset your password.";
        case "auth/network-request-failed":
            return "Network connection issue. Please check your internet connection.";
        default:
            return error.message || "An unexpected error occurred.";
    }
}

/**
 * Submit a new waste complaint report
 * Saves document to reports/{reportId} with all modern and backward-compatible fields
 */
export async function submitReportToFirebase(reportData, imageFile) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase is not configured yet. Please configure firebase-config.js.");
    }

    let uploadedImageUrl = "";
    if (imageFile) {
        try {
            uploadedImageUrl = await uploadReportImage(imageFile, reportData.userId, reportData.reportId);
        } catch (imgErr) {
            console.warn("Non-fatal image upload failure, proceeding with report submission:", imgErr);
            uploadedImageUrl = "";
        }
    }

    const categoryValue = reportData.category || reportData.wasteType || reportData.type || "Other";
    const userEmail = (reportData.userEmail || "").toLowerCase();

    const newReport = {
        reportId: reportData.reportId,
        userId: reportData.userId,
        userName: reportData.userName || "Citizen",
        userEmail: userEmail,
        // Store in all standard & legacy field names for 100% compatibility across versions
        category: categoryValue,
        wasteType: categoryValue,
        type: categoryValue,
        complaintType: categoryValue,
        description: reportData.description || "",
        imageUrl: uploadedImageUrl,
        image: uploadedImageUrl,
        location: reportData.location || "N/A",
        address: reportData.address || reportData.location || "N/A",
        latitude: reportData.latitude ?? null,
        longitude: reportData.longitude ?? null,
        status: "Pending",
        ecoPoints: reportData.ecoPoints || 20,
        clusterId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: null
    };

    // Save report document directly to reports/{reportId}
    const reportDocRef = doc(db, "reports", reportData.reportId);
    await setDoc(reportDocRef, newReport);

    // Atomically increment user's ecoPoints and reports count in Firestore
    try {
        const userDocRef = doc(db, "users", reportData.userId);
        await updateDoc(userDocRef, {
            ecoPoints: increment(20),
            reportsCount: increment(1),
            wasteManaged: increment(1),
            updatedAt: serverTimestamp()
        });
    } catch (e) {
        console.warn("Could not update user statistics in Firestore:", e);
    }

    return { ...newReport, docId: reportData.reportId };
}

/**
 * Subscribe to user's submitted reports in real-time
 */
export function subscribeToUserReports(userId, onUpdate, onError) {
    if (!isFirebaseConfigured() || !userId) return () => {};

    const q = query(
        collection(db, "reports"),
        where("userId", "==", userId)
    );

    return onSnapshot(q, (snapshot) => {
        const reports = [];
        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            const category = getReportCategory(data);
            reports.push({
                docId: doc.id,
                reportId: data.reportId || doc.id,
                ...data,
                category: category,
                wasteType: category,
                type: category,
                complaintType: category,
                imageUrl: data.imageUrl || data.image || "",
                image: data.imageUrl || data.image || ""
            });
        });
        // Sort newest first using robust timestamp extractor
        reports.sort((a, b) => getReportTimestamp(b) - getReportTimestamp(a));
        onUpdate(reports);
    }, (error) => {
        if (error && error.code === "permission-denied") {
            console.warn("User reports subscription: permission pending or restricted.");
        } else {
            console.warn("User reports subscription event:", error?.message || error);
        }
        if (onError) onError(error);
    });
}

/**
 * Subscribe to all reports for the Admin panel in real-time
 */
export function subscribeToAllReports(onUpdate, onError) {
    if (!isFirebaseConfigured()) return () => {};

    const q = query(collection(db, "reports"));

    return onSnapshot(q, (snapshot) => {
        const reports = [];
        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            const category = getReportCategory(data);
            reports.push({
                docId: doc.id,
                reportId: data.reportId || doc.id,
                ...data,
                category: category,
                wasteType: category,
                type: category,
                complaintType: category,
                imageUrl: data.imageUrl || data.image || "",
                image: data.imageUrl || data.image || ""
            });
        });
        // Sort newest first
        reports.sort((a, b) => getReportTimestamp(b) - getReportTimestamp(a));
        onUpdate(reports);
    }, (error) => {
        if (error && error.code === "permission-denied") {
            console.warn("All reports subscription requires administrator role or updated permissions.");
        } else {
            console.warn("All reports subscription event:", error?.message || error);
        }
        if (onError) onError(error);
    });
}

/**
 * Update report status (Admin only)
 * Stores status, updatedAt, and updatedBy as required
 */
export async function updateReportStatusInFirebase(docId, newStatus, updatedBy = "Admin") {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase is not configured yet.");
    }

    const reportDocRef = doc(db, "reports", docId);
    await updateDoc(reportDocRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
    });
}

// ==============================================================================
// USER & ROLE MANAGEMENT SERVICES (ADMIN ONLY)
// ==============================================================================

/**
 * Fetch all registered users from Firestore (Admin only)
 */
export async function getAllUsersFromFirebase() {
    if (!isFirebaseConfigured()) return [];
    const usersCol = collection(db, "users");
    const querySnapshot = await getDocs(usersCol);
    const users = [];
    querySnapshot.forEach((docSnap) => {
        users.push({ uid: docSnap.id, ...docSnap.data() });
    });
    // Sort by name or creation date
    users.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return users;
}

/**
 * Promote or revoke admin access for a user in Firestore
 * Enforced by Firestore Security Rules: Only authorized admins can update roles
 */
export async function updateUserRoleInFirebase(targetUid, newRole) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase is not configured yet.");
    }
    if (newRole !== "admin" && newRole !== "user") {
        throw new Error("Invalid role. Role must be 'admin' or 'user'.");
    }

    const userDocRef = doc(db, "users", targetUid);
    await updateDoc(userDocRef, {
        role: newRole,
        updatedAt: serverTimestamp()
    });
}
