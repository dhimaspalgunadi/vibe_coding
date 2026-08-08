import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function LoginPage() {
  const { login, sesi } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sesi) navigate(sesi.peran === "admin" ? "/admin" : "/pimpinan", { replace: true });
  }, [sesi, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk.");
      setLoading(false);
    }
  }

  return (
    <div className="layar-tengah">
      <form className="kartu kartu-login" onSubmit={submit}>
        <h1>Rekap Absensi</h1>
        <p className="teks-muted">Masuk untuk melanjutkan.</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="pesan-error">{error}</p>}
        <button type="submit" className="tombol tombol-primer" disabled={loading}>
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
