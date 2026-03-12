'use client';

import { useState } from 'react';

interface LoginProps {
  onLogin: (user: { id: string; email: string; name: string }, sessionId: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body: any = { email, password };
      if (!isLogin) {
        body.name = name;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store session in localStorage
      localStorage.setItem('sessionId', data.sessionId);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLogin(data.user, data.sessionId);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center relative px-4"
      style={{
        backgroundImage: 'url(/premium_photo-1683141114059-aaeaf635dc05.avif)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="w-full flex">
        {/* Left Side - Login Dialog */}
        <div className="w-3/5 flex items-center pl-8">
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full shadow-2xl border border-white/30">
        <div className="text-start mb-8">
          <h1 className="text-3xl font-bold text-black mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-black">
            {isLogin ? 'Sign in to access your projects' : 'Sign up to start creating projects'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-semibold text-black">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={loading}
                className="w-full px-4 py-3 bg-white/90 border-2 border-white/50 rounded-lg text-base transition-colors focus:outline-none focus:border-white focus:bg-white disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block mb-2 text-sm font-semibold text-black">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
              className="w-full px-4 py-3 bg-white/90 border-2 border-white/50 rounded-lg text-base transition-colors focus:outline-none focus:border-white focus:bg-white disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-2 text-sm font-semibold text-black">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              className="w-full px-4 py-3 bg-white/90 border-2 border-white/50 rounded-lg text-base transition-colors focus:outline-none focus:border-white focus:bg-white disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800"
            />
          </div>

          {error && (
            <div className="bg-red-500/80 backdrop-blur-sm text-white font-bold px-4 py-3 rounded-lg text-sm border border-red-400/50">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-gradient-to-r from-cyan-500/80 to-blue-500/80 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-6 py-3 rounded-lg text-base transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none backdrop-blur-sm border border-white/30"
          >
            {loading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-black hover:underline text-sm font-bold"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
          </div>
        </div>
        
        {/* Right Side - Empty space for background */}
        <div className="w-2/5"></div>
      </div>
    </div>
  );
}


