"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Signup() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: "", password: "", location: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Live Password Validation rules
  const passwordRules = [
    { id: "length", label: "Minimum 8 characters", test: (pw: string) => pw.length >= 8 },
    { id: "upper", label: "At least 1 uppercase letter", test: (pw: string) => /[A-Z]/.test(pw) },
    { id: "lower", label: "At least 1 lowercase letter", test: (pw: string) => /[a-z]/.test(pw) },
    { id: "number", label: "At least 1 number", test: (pw: string) => /[0-9]/.test(pw) },
    { id: "special", label: "At least 1 special character", test: (pw: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) }
  ];

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Verify all rules pass before submitting
    const isValid = passwordRules.every(rule => rule.test(formData.password));
    if (!isValid) {
      setError("Please meet all password requirements");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      }).catch(() => null);

      if (!res) {
        throw new Error("Backend server is not responding. Please ensure the server is running on port 5000.");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      router.push("/login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden py-10">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="glass-panel p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-md relative z-10 border border-white/10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Create Account</h1>
          <p className="text-gray-400">Join the CampusConnect community</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username (Website ID)</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Location (City)</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors mb-3"
              required
            />
            
            {/* Live Password Validation UI */}
            <div className="bg-black/30 p-4 rounded-xl space-y-2 text-sm">
              <p className="text-gray-300 font-semibold mb-2">Password requirements:</p>
              {passwordRules.map(rule => {
                const passed = rule.test(formData.password);
                return (
                  <div key={rule.id} className="flex items-center gap-2">
                    {passed ? (
                      <span className="text-green-400">✅</span>
                    ) : (
                      <span className="text-red-400">❌</span>
                    )}
                    <span className={passed ? "text-green-400" : "text-gray-400"}>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold py-3 px-6 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all transform hover:-translate-y-1 disabled:opacity-50 mt-4"
          >
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-8 text-center text-gray-400 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
