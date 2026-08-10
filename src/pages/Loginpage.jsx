import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserAlt, FaEye, FaEyeSlash,FaSignInAlt} from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import Logo from "/src/assets/Municipality-of-Rosario.png";
import { login } from "../auth";

import "./css_pages/Loginpage.css";

function Loginpage() {
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [showPassword,    setShowPassword]    = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Go back to where they were before being redirected to login.
  // Default to /dashboard if no previous location saved.
  const from = location.state?.from?.pathname || "/dashboard";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Trim email to prevent accidental whitespace failures
    const trimmedEmail    = email.trim();
    const trimmedPassword = password.trim();

    try {
      const result = await login(trimmedEmail, trimmedPassword);

      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || "Invalid credentials.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="containerbody">
      <div className="container">
        <div className="left-side">
          <div className="Logo">
            <img src={Logo} alt="Municipality of Rosario Logo" />
          </div>
        </div>
        <div className="form-box login">
          <form onSubmit={handleLogin} noValidate>
            <h1>Rosario LGU </h1>
            <h1>HRIS Portal</h1>

            {/* Fix: role="alert" so screen readers announce errors immediately */}
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            {/* Fix: proper <label> elements for accessibility & autofill */}
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                maxLength={254}
              />
              {/* Fix: aria-hidden so screen readers skip decorative icon */}
              <span className="input-icon" aria-hidden="true">
                <FaUserAlt />
              </span>
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                maxLength={128}
              />
              {/* Fix: password visibility toggle instead of a static icon */}
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {/* Fix: <button type="button"> instead of dead <a href="#"> */}
            <div className="forgot-link">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
            <FaSignInAlt /> {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Loginpage;