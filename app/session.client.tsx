import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Initialize Firebase
const firebaseConfig = require("../firebaseConfig.json");

export const clientAuth = getAuth(initializeApp(firebaseConfig));
