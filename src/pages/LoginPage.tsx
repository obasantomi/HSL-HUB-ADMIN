import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Logged in");
      navigate("/");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src="/assets/hsl-mark.png" alt="HSL" />
          <div>
            <p>HSL HUB</p>
            <strong>Admin Portal</strong>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@covenantuniversity.edu.ng"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </label>
          <button type="submit" className="button button--black" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
