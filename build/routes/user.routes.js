// routes/auth.routes.js
import express from "express";
import { userController } from "./controllers/user.controller.js";

     export default function userRouter(db,ci) {
     const router = express.Router();
     const { loginUser, createUser, deleteUser, modifyUser } = userController(db,ci);

     router.post('/login', loginUser);
     router.post('/register', createUser);
     router.delete('/delete', deleteUser);
     router.put('/modify', modifyUser);

     return router;
}
