import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' }).single('image');


// ================== User Controller ==================

export function userController(db) {
     return {
          // =============== Login User =============== //
          /**
           * Authenticates user with username or email and password.
           * Returns a JWT token for authenticated users.
           */
          loginUser: (req, res) => {
               const { username, password } = req.body;
               if (!username || !password) {
                    return res.status(400).json({ error: 'Missing username or password fields.' });
               }

               try {
                    const query = `
                         SELECT user_id AS id, email, username, role, password
                         FROM Users
                         WHERE username = ? OR email = ?
                    `;
                    db.query(query, [username, username], (err, result) => {
                         if (err) {
                         console.error('DB error fetching user:', err);
                         return res.status(500).json({ error: 'Database error' });
                         }

                         const user = result[0];
                         if (!user || user.password !== password) {
                         return res.status(400).json({ message: 'Incorrect username/email or password.', error: 'Invalid credentials' });
                         }

                         const payload = { id: user.id, email: user.email, username: user.username, role: user.role };
                         const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: '7d' });

                         res.cookie('session_token', token, {
                         httpOnly: true,
                         secure: false,
                         sameSite: 'strict',
                         maxAge: 7 * 24 * 60 * 60 * 1000,
                         });

                         return res.status(200).json({ message: 'Login successful', error: '' });
                    });
               } catch (error) {
                    console.error('Login error:', error);
                    return res.status(500).json({ error: 'Internal server error' });
               }
          },

          // =============== Create User =============== //
          /**
           * Registers a new user with username, email, and password.
           * Assigns a random profile image and creates a wallet.
           */
          createUser: (req, res) => {
               const { username, email, password } = req.body;
               if (!username || !password) {
                    return res.status(400).json({ error: 'Missing required fields.' });
               }

               const user = {
                    user_id: randomUUID(),
                    username,
                    email,
                    password,
                    img: `../data/images/profiles-images/${Math.floor(Math.random() * 8) + 1}.png`,
                    time: new Date().toISOString().slice(0, 19).replace('T', ' '),
                    description: "There's nothing here yet... or maybe you're just not seeing it right.",
                    role: 'user',
                    rate: 0,
               };

               try {
                    // Check if user already exists
                    const existingUserStmt = `
                         SELECT * FROM Users WHERE username = ? OR email = ?
                    `;
                    db.query(existingUserStmt, [username, email], (err, existingUser) => {
                         if (err) {
                         console.error('Error checking user existence:', err);
                         return res.status(500).json({ error: 'Database error' });
                         }

                         if (existingUser.length > 0) {
                         return res.status(409).json({ error: 'User already exists' });
                         }

                         // Insert new user
                         const insertUserStmt = `
                              INSERT INTO Users (user_id, username, email, password, img, time, description, role, rate)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                         `;
                         db.query(insertUserStmt, [
                         user.user_id,
                         user.username,
                         user.email,
                         user.password,
                         user.img,
                         user.time,
                         user.description,
                         user.role,
                         user.rate
                         ], (err, insertResult) => {
                         if (err) {
                              console.error('Error inserting user:', err);
                              return res.status(500).json({ error: 'Server error while creating user' });
                         }

                         // Create wallet for the user
                         const wallet = {
                              wallet_id: randomUUID(),
                              user_id: user.user_id,
                              balance: 0,
                              created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                         };

                         const insertWalletStmt = `
                              INSERT INTO Wallets (wallet_id, user_id, balance, created_at)
                              VALUES (?, ?, ?, ?)
                         `;
                         db.query(insertWalletStmt, [
                              wallet.wallet_id,
                              wallet.user_id,
                              wallet.balance,
                              wallet.created_at
                         ], (err, walletResult) => {
                              if (err) {
                                   console.error('Error inserting wallet:', err);
                                   return res.status(500).json({ error: 'Server error while creating wallet' });
                              }

                              // Generate JWT token for the new user
                              const payload = { id: user.user_id, email: user.email, username: user.username, role: user.role };
                              const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: '7d' });

                              res.cookie('session_token', token, { httpOnly: true, secure: false, sameSite: 'strict', maxAge: 604800000 });
                              return res.status(201).json({
                                   username: user.username,
                                   email: user.email,
                                   message: 'User created successfully',
                                   user_id: user.user_id
                              });
                         });
                         });
                    });
               } catch (err) {
                    console.log('Error creating user:', err);
                    return res.status(500).json({ error: `Server error while creating user: ${err.message}` });
               }
          },

          // =============== Delete User =============== //
          /**
           * Deletes a user by verifying username and password using the database.
           */
          deleteUser: (req, res) => {
               const { username, password } = req.body;
               if (!username || !password) {
                    return res.status(400).json({ error: 'Missing required fields.' });
               }

               try {
                    // Check if the user exists in the database
                    const stmt = `
                         SELECT * FROM Users WHERE username = ? AND password = ?
                    `;
                    db.query(stmt, [username, password], (err, user) => {
                         if (err) {
                         console.error('Error fetching user:', err);
                         return res.status(500).json({ error: 'Database error' });
                         }

                         if (user.length === 0) {
                         return res.status(400).json({ message: "Incorrect username or password", error: "Invalid credentials" });
                         }

                         // Delete the user from the database
                         const deleteStmt = `
                         DELETE FROM Users WHERE user_id = ?
                         `;
                         db.query(deleteStmt, [user[0].user_id], (err, deleteResult) => {
                         if (err) {
                              console.error('Error deleting user:', err);
                              return res.status(500).json({ error: 'Error deleting user' });
                         }

                         // Optionally, delete related wallet and other data
                         const deleteWalletStmt = `
                              DELETE FROM Wallets WHERE user_id = ?
                         `;
                         db.query(deleteWalletStmt, [user[0].user_id], (err, walletResult) => {
                              if (err) {
                                   console.error('Error deleting wallet:', err);
                                   return res.status(500).json({ error: 'Error deleting wallet' });
                              }

                              return res.status(200).json({ message: "User successfully deleted" });
                         });
                         });
                    });
               } catch (err) {
                    console.error('Error deleting user:', err);
                    return res.status(500).json({ error: 'Server error while deleting user' });
               }
          },
          // =============== Modify User =============== //
          /**
           * modify user img, username, password etc...
           * need JWT token for authenticated user.
           */
          modifyUser: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
               return res.status(401).json({ error: 'Unauthorized' });
               }

               const userInfo = jwt.verify(token, process.env.SECRET_KEY)
               
               upload(req, res, async (err) => {

                    if (err) {
                    return res.status(400).json({ error: err.message });
                    }
                    
                    const { username, password, img, description } = req.body;

                    // verify format content
                    const isInvalidFormat = Object.values(req.body).some(value => typeof value !== "string");
                    if (isInvalidFormat) {
                         return res.status(401).json({ err: "Error: invalid format" });
                    }

                    try {
                         const stmt = `SELECT * FROM Users WHERE user_id = ?`;
                         db.query(stmt, [userInfo.user_id], (err, user) => {
                              if (err) {
                                   console.error('Error fetching user:', err);
                                   return res.status(500).json({ error: 'Database error' });
                              }

                              if (user.length === 0) {
                                   return res.status(400).json({ message: "User not found", error: "Invalid user ID" });
                              }

                              // Crear el objeto de campos a actualizar
                              const fieldsToUpdate = {};
                              if (img !== undefined) fieldsToUpdate.img = img;
                              if (description !== undefined) fieldsToUpdate.description = description;
                              if (username !== undefined) fieldsToUpdate.username = username;
                              if (password !== undefined) fieldsToUpdate.password = password;

                              // Si no hay campos para actualizar
                              if (Object.keys(fieldsToUpdate).length === 0) {
                                   return res.status(400).json({ message: "No fields to update" });
                              }

                              // Construir la parte SET de la consulta
                              const setClause = Object.keys(fieldsToUpdate)
                                   .map(field => `${field} = ?`)
                                   .join(', ');

                              const values = Object.values(fieldsToUpdate);
                              const updateStmt = `UPDATE Users SET ${setClause} WHERE user_id = ?`;

                              // Ejecutar la consulta de actualización
                              db.query(updateStmt, [...values, userInfo.user_id], (updateErr, result) => {
                                   if (updateErr) {
                                        console.error('Error updating user:', updateErr);
                                        return res.status(500).json({ error: 'Database error while updating user' });
                                   }

                                   return res.status(200).json({ message: "User successfully modified" });
                              });
                         });
                    } catch (err) {
                         console.error('Error processing request:', err);
                         return res.status(500).json({ error: 'Server error while processing request' });
                    }

               })
          }
     };
}
