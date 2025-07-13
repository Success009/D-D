import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA6sANvYoAkXHYG8MjbZl6Pyq23CNdBuzA",
  authDomain: "community-canvas-255fa.firebaseapp.com",
  databaseURL: "https://community-canvas-255fa-default-rtdb.firebaseio.com",
  projectId: "community-canvas-255fa",
  storageBucket: "community-canvas-255fa.appspot.com",
  messagingSenderId: "729445267995",
  appId: "1:729445267995:web:05da6756d66c58b9ccd6be",
  measurementId: "G-FW93CB5QL7"
};

firebase.initializeApp(firebaseConfig);
export const db = firebase.database();
export const storage = firebase.storage();