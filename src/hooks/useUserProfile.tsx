// src/hooks/useUserProfile.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const useUserProfile = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);

        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();

          // Lấy avatar từ Google hoặc từ Firestore
          const currentPhotoURL = user.photoURL || userData.photoURL;
          setUserAvatar(currentPhotoURL || null);

          // Cập nhật photoURL vào Firestore nếu avatar Google thay đổi
          if (user.photoURL && userData.photoURL !== user.photoURL) {
            await setDoc(userDocRef, { photoURL: user.photoURL }, { merge: true });
          }
        }
      } else {
        setIsLoggedIn(false);
        setUserAvatar(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return {
    isLoggedIn,
    userAvatar,
    isLoading,
  };
};