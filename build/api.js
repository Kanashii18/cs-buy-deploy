import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== | cloudinary | ==================== //

import cloudinary from 'cloudinary';

cloudinary.v2.config({
    cloud_name: 'dkmcz80mt',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ======================== | DB | ======================== //

import mysql from 'mysql2';

// Crear la conexión a la base de datos
const caCert = fs.readFileSync('./db/ca.pem');

const db = mysql.createConnection({
     port: 19390,
     host: 'mysql-a7f48e8-danieltlegaming-e8c0.h.aivencloud.com',  // Usar la IP obtenida
     user: 'avnadmin',
     password: process.env.SQL_PASSWORD,
     database: 'defaultdb',
     connectTimeout: 3600000,
     ssl: {
          ca:caCert
     }
});

db.connect((err) => {
    if (err) {
        console.error('Failed to connect to the DB:', err.message);
    } else {
        console.log('Connected to the DB...');
    }
});  

// Initialize express app
const app = express();
const port = 3004;

// ============================================================ //

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// =====================|| Websocket Chat ||===================== //

const httpServer = createServer(app);
const io = new Server(httpServer);

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join chat room
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    // Handle sending message
    socket.on('send_message', (data) => {
        io.to(data.roomId).emit('receive_message', data);
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// ============================================================ //

// Static file paths

// Middleware
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ limit: '4mb', extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'dist')));

// CORS configurations
app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true
}));

// ========================= || Routes || ========================== //

import userRouter from './routes/user.routes.js';
import authRouter from './routes/auth.routes.js';
import chatRouter from './routes/chat.routes.js';
import sellerRouter from './routes/seller.routes.js';
import checkoutRouter from './routes/purchase.routes.js';
import orderRouter from './routes/order.routes.js';

// ========================== || Routes Definition || ========================== //

app.use('/api/user', userRouter(db,cloudinary)); // User routes
app.use('/api/auth', authRouter(db)); // Authentication routes
app.use('/api/seller', sellerRouter(db,cloudinary)); // Seller routes
app.use('/api/verify/checkout', checkoutRouter(db)); // Checkout routes
app.use('/api/chat', chatRouter(db,io)); // Chat routes
app.use('/api/order',orderRouter(db));

// =====================|| Set Server ||===================== //

httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
});

