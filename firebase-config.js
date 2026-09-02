// Firebase Project Configuration for 'chatsample'
// You can replace these credentials with your actual Firebase Console settings.
const firebaseConfig = {
  apiKey: "AIzaSyChatsSampleMockApiKeyForDev12345",
  authDomain: "chatsample.firebaseapp.com",
  databaseURL: "https://chatsample-default-rtdb.firebaseio.com",
  projectId: "chatsample",
  storageBucket: "chatsample.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.warn("Firebase initialization warning:", e);
  }
}
