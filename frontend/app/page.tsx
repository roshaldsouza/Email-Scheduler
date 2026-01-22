"use client";

import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useAuth } from "./context/AuthContext";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-center mb-8 text-gray-900">Login</h1>

        {/* Google Login Button */}
        <div className="mb-4">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              try {
                const idToken = credentialResponse.credential;

                const res = await axios.post(
                  `${process.env.NEXT_PUBLIC_API_URL}/auth/google`,
                  { idToken }
                );

                login(res.data.token, res.data.user);
                router.push("/dashboard");
              } catch (err: any) {
                console.log("LOGIN ERROR:", err);
                console.log("LOGIN ERROR RESPONSE:", err?.response?.data);
                alert(err?.response?.data?.message || "Login failed");
              }
            }}
            onError={() => alert("Google Login Failed")}
            type="standard"
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
            width="100%"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-400">or sign up through email</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Email/Password Form */}
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />

          <button
            onClick={() => {
              // Add email/password login logic here if needed
              alert("Email/password login not implemented yet");
            }}
            className="w-full bg-green-600 text-white rounded-lg py-3 font-medium hover:bg-green-700 transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    </main>
  );
}