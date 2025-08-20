import express from "express";
import {chatGestion} from "./controllers/chat/overview.js";
import {messageGestion} from "./controllers/chat/messages.js";


export default function chatRouter(db, io){
     const router = express.Router();

     const { overview, markAsRead } = chatGestion(db);
     const { postChat,readRoom } = messageGestion(db);

     router.get('/overview', overview);
     router.put('/markAsRead', markAsRead);
     router.post('/messages', readRoom);
     router.put('/messages', postChat);
     
     return router;
}
