// src/firebase-config.ts

// Nhập các hàm cần thiết từ Firebase SDK
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Cấu hình dự án Firebase của bạn
const firebaseConfig = {
  apiKey: "AIzaSyAz23d8wz1py3K1fbikMBQiH5Ld4aO0Fw4",
  authDomain: "auratones-123456.firebaseapp.com",
  projectId: "auratones-123456",
  storageBucket: "auratones-123456.firebasestorage.app",
  messagingSenderId: "314005488461",
  appId: "1:314005488461:web:46670430d63edfa7f96d04"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo các dịch vụ
export const auth = getAuth(app);
export const db = getFirestore(app);