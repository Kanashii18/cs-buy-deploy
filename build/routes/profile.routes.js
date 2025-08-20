import express from "express";
const router = express.Router();
import { auth_session} from "./controllers/auth/session.js";
import { user_check } from "./controllers/auth/checking.js";

router.get('/session-check', auth_session);
router.get("/user-check", user_check);

export default router;
