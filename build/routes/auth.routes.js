// routes/auth.routes.js
import express from "express";
import { auth_session } from "./controllers/auth/session.js";
import { user_check, seller_check } from "./controllers/auth/checking.js";
import { get_wallet } from "./controllers/auth/wallet.js";
import { logout } from "./controllers/auth/logout.js";

export default function authRouter(db) {
  const router = express.Router();

  router.get('/session-check', (req, res) => auth_session(db, req, res));

  router.get("/user-check", (req, res) => user_check(db, req, res));
  router.post("/seller-check", (req, res) => seller_check(db, req, res));
  
  router.post('/get-wallet', (req, res) => get_wallet(db, req, res));
  router.post('/logout', (req, res) => logout(req, res));
  
  return router;
}
