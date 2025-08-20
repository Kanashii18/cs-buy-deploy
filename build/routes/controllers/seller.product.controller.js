import jwt from 'jsonwebtoken';
import pkg from 'uuid';
const { v4 } = pkg;
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
import multer from 'multer';
const upload = multer({ dest: 'uploads/' }).single('image');

export function gestionProduct(db, ci) {
    return {
        addProduct: (req, res) => {
            // Verificamos que haya un token de sesión
            const token = req.cookies.session_token;
            if (!token) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            try {
                // Verificamos el token con JWT
                const userInfo = jwt.verify(token, process.env.SECRET_KEY);
                if (!userInfo) {
                    return res.status(401).json({ error: 'Invalid token' });
                }

                // Usamos multer para manejar el archivo de la imagen
                upload(req, res, async (err) => {
                    if (err) {
                        return res.status(400).json({ error: err.message });
                    }

                    if (!req.file) {
                        return res.status(400).json({ error: 'No file uploaded' });
                    }

                    const { title, category, description, price, deliveryUnit, accounts } = req.body;
                    let accountsParsed = [];

                    // VALIDATE TITLE
                    if (typeof title !== "string" || title.length === 0 || title.length > 42) {
                        return res.status(400).json({ error: "Title is required and must be a string with max 42 characters" });
                    }

                    // VALIDATE CATEGORY
                    const validCategories = ["account", "service", "assets"];
                    if (typeof category !== "string" || !validCategories.includes(category.toLowerCase())) {
                        return res.status(400).json({ error: `Category must be one of: ${validCategories.join(", ")}` });
                    }

                    // VALIDATE DESCRIPTION
                    if (typeof description !== "string") {
                        return res.status(400).json({ error: "Description must be a string" });
                    }

                    // VALIDATE PRICE
                    const price_value = parseInt(price);
                    if (price_value <= 0 || price_value >= 1250) {
                        return res.status(400).json({ error: "Price must be a positive number" });
                    }

                    // VALIDATE DELIVERY UNIT
                    const deliveryUnit_content = JSON.parse(deliveryUnit);
                    if (deliveryUnit_content.type !== "instant" && deliveryUnit_content.type !== "minutes" && deliveryUnit_content.type !== "hours") {
                        return res.status(400).json({ error: `Delivery unit error` });
                    }

                    accountsParsed = JSON.parse(accounts);  
                    if (!Array.isArray(accountsParsed) || accountsParsed.length === 0) {
                        return res.status(400).json({ error: "Accounts must be a non-empty array" });
                    }

                    // Verificar si la categoría es 'account' y si no hay cuentas
                    if (accountsParsed.length <= 0 && category.toLowerCase() === "account") {
                        return res.status(400).json({ error: "Account category needs accounts" });
                    }

                    const quantity = accountsParsed.length;

                    // Subir la imagen a Cloudinary si se proporciona
                    const product_id = v4();
                    let imageUrl = null;

                    if (req.file) {
                         try {
                              const result = await ci.uploader.upload(req.file.path, {
                                   folder: 'images',  // Puedes definir una carpeta para organizar las imágenes
                              });
                              imageUrl = result.secure_url
                         } catch (err) {
                              console.error(err);
                              res.status(500).json({ error: 'Error al subir la imagen' });
                         }
                    }
                         console.log('el img: ',imageUrl);

                         const insertProduct = `
                         INSERT INTO Products (   
                              product_id, user_id, title, price, deliveryUnit, delivery_value, quantity, image, category, description
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         `;

                         // Guardar el producto en la base de datos
                         db.query(insertProduct, [
                         product_id,
                         userInfo.id, // User ID from token
                         title,
                         price_value,
                         deliveryUnit_content.type,
                         deliveryUnit_content.value,
                         quantity,
                         imageUrl,  // Guardar la URL de la imagen subida a Cloudinary
                         category,
                         description
                         ], (err, results) => {
                         if (err) {
                              console.error('DB error inserting product:', err);
                              return res.status(500).json({ error: `Server error: ${err.message}` });
                         }

                         // Insertar las cuentas del producto en Product_Accounts
                         const insertAccount = `
                              INSERT INTO Product_Accounts (
                                   account_id, product_id, seller_id, information
                              ) VALUES (?, ?, ?, ?)
                         `;

                         accountsParsed.forEach(account => {
                              const account_id = v4(); // Generar un UUID para cada cuenta
                              db.query(insertAccount, [
                                   account_id,
                                   product_id,
                                   userInfo.id,
                                   account.content // Acceder correctamente a account.content
                              ], (err, accountResult) => {
                                   if (err) {
                                        console.error('Error inserting account:', err);
                                        return res.status(500).json({ error: `Error inserting account: ${err.message}` });
                                   }
                              });
                         });

                         return res.status(200).json({
                              message: 'Product added successfully',
                              product: {
                                   product_id,
                                   user_id: userInfo.id,
                                   title,
                                   price,
                                   quantity,
                                   category,
                                   description,
                                   deliveryUnit,
                                   image: imageUrl  // También devolver la URL de la imagen subida
                              }
                         });
                         });
                    });

               } catch (err) {
                    console.error('Error adding product:', err);
                    return res.status(500).json({ error: `Server error, ${err}` });
               }
          },
          // =============== Delete Product =============== //
          /**
           * Deletes a product from the database.
           * The user must be authenticated and the owner of the product.
           */
          deleteProduct: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               try {
                    const userInfo = jwt.verify(token, process.env.SECRET_KEY);

                    const { product_id } = req.body;
                    if (!product_id) {
                         return res.status(400).json({ error: 'Product ID is required' });
                    }

                    const getProduct = `
                         SELECT * FROM Products WHERE product_id = ?
                    `;
                    db.query(getProduct, [product_id], (err, product) => {
                         if (err) {
                         return res.status(500).json({ error: 'Error querying product' });
                         }

                         if (product.length === 0) {
                         return res.status(404).json({ error: 'Product not found' });
                         }

                         if (product[0].user_id !== userInfo.id) {
                         return res.status(403).json({ error: 'You do not have permission to delete this product' });
                         }

                         const delProduct = `
                         DELETE FROM Products WHERE product_id = ?
                         `;
                         db.query(delProduct, [product_id], (err, deleteResult) => {
                         if (err) {
                              return res.status(500).json({ error: 'Error deleting product' });
                         }
                         return res.status(200).json({ message: 'Product deleted successfully' });
                         });
                    });

               } catch (err) {
                    console.error('Error deleting product:', err);
                    return res.status(500).json({ error: 'Server error' });
               }
          },
          // =============== Modify Products =============== //
          /**
           * Modify a specific product.
           */
          updateProduct: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               try {
               // Verificamos el token con JWT
               const userInfo = jwt.verify(token, process.env.SECRET_KEY);
               if (!userInfo) {
                    return res.status(401).json({ error: 'Invalid token' });
               }

               // Usamos multer para manejar el archivo de la imagen
               upload(req, res, async (err) => {

                    if (err) {
                         return res.status(400).json({ error: err.message });
                    }

                    const { title, category, description, price, deliveryUnit, accounts } = req.body;
                    let accountsParsed = [];
                    const product_id = req.query.e
                    
                    // VALIDATE TITLE
                    if (typeof title !== "string" || title.length === 0 || title.length > 42) {
                    return res.status(400).json({ error: "Title is required and must be a string with max 42 characters" });
                    }

                    // VALIDATE CATEGORY
                    const validCategories = ["account", "service", "assets"];
                    if (typeof category !== "string" || !validCategories.includes(category.toLowerCase())) {
                    return res.status(400).json({ error: `Category must be one of: ${validCategories.join(", ")}` });
                    }

                    // VALIDATE DESCRIPTION
                    if (typeof description !== "string") {
                    return res.status(400).json({ error: "Description must be a string" });
                    }

                    // VALIDATE PRICE
                    const price_value = parseInt(price);
                    if (price_value <= 0 || price_value >= 1250) {
                    return res.status(400).json({ error: "Price must be a positive number" });
                    }

                    // VALIDATE DELIVERY UNIT
                    const deliveryUnit_content = JSON.parse(deliveryUnit);
                    if (deliveryUnit_content.type !== "instant" && deliveryUnit_content.type !== "minutes" && deliveryUnit_content.type !== "hours") {
                    return res.status(400).json({ error: `Delivery unit error` });
                    }

                    accountsParsed = JSON.parse(accounts);  
                    if (!Array.isArray(accountsParsed) || accountsParsed.length === 0) {
                    return res.status(400).json({ error: "Accounts must be a non-empty array" });
                    }

                    // Verificar si la categoría es 'account' y si no hay cuentas
                    if (accountsParsed.length <= 0 && category.toLowerCase() === "account") {
                    return res.status(400).json({ error: "Account category needs accounts" });
                    }

                    // Subir la imagen a Cloudinary si se proporciona
                    let imageUrl = null;
                    if (req.file) {
                         try {
                              const result = await ci.uploader.upload(req.file.path, {
                              folder: 'images', // Carpeta de Cloudinary
                              });
                              imageUrl = result.secure_url;
                         } catch (err) {
                              console.error(err);
                              return res.status(500).json({ error: 'Error al subir la imagen' });
                         }
                    } else if (req.body.image && typeof req.body.image === 'string') {
                         // Si es una URL, la validamos
                         const url = req.body.image;

                         // Verificar que la URL apunte a una imagen válida (usamos HEAD para verificar el tipo de contenido)
                         try {
                              const response = await axios.head(url); // Usamos HEAD para solo obtener los headers
                              const contentType = response.headers['content-type'];

                              // Verificamos que el contenido sea de tipo imagen
                              if (contentType && contentType.startsWith('image/')) {

                              // Verificar que la URL provenga de un dominio confiable (Cloudinary en este caso)
                              const cloudinaryDomain = 'https://res.cloudinary.com/';
                              if (!url.startsWith(cloudinaryDomain)) {
                                   return res.status(400).json({ error: 'La URL no proviene de un dominio confiable (ejemplo: Cloudinary)' });
                              }

                              imageUrl = url; // Si la URL es válida, la asignamos
                              } else {
                                   return res.status(400).json({ error: 'La URL proporcionada no es una imagen válida' });
                              }

                         } catch (error) {
                              console.error('Error al verificar la URL:', error);
                              return res.status(400).json({ error: 'La URL proporcionada no es válida o no apunta a una imagen' });
                         }
                    }

                    // Actualización del producto en la base de datos
                    const updateProductQuery = `
                    UPDATE Products
                    SET title = ?, category = ?, description = ?, price = ?, deliveryUnit = ?, delivery_value = ?, image = ?, quantity = ?
                    WHERE product_id = ? AND user_id = ?
                    `;

                    db.query(updateProductQuery, [
                    title,
                    category,
                    description,
                    price_value,
                    deliveryUnit_content.type,
                    deliveryUnit_content.value,
                    imageUrl || req.body.image, // Si hay una imagen nueva, usamos imageUrl, sino usamos la URL existente
                    accountsParsed.length, // Solo actualizamos la cantidad
                    product_id,
                    userInfo.id
                    ], (err, results) => {
                    if (err) {
                         console.error('Error al actualizar producto:', err);
                         return res.status(500).json({ error: `Error al actualizar el producto: ${err.message}` });
                    }
                    const deleteAccountsQuery = `
                         DELETE FROM Product_Accounts
                         WHERE product_id = ? AND seller_id = ?
                    `;

                    db.query(deleteAccountsQuery, [product_id, userInfo.id], (err) => {
                         if (err) {
                         console.error('Error al eliminar las cuentas:', err);
                         return res.status(500).json({ error: `Error al eliminar cuentas: ${err.message}` });
                         }

                         // Luego insertamos las nuevas cuentas
                         const insertAccountQuery = `
                         INSERT INTO Product_Accounts (account_id, product_id, seller_id, information)
                         VALUES (?, ?, ?, ?)
                         `;

                         accountsParsed = JSON.parse(accounts); // Parseamos las cuentas desde el frontend
                         
                         accountsParsed.forEach(account => {
                         db.query(insertAccountQuery, [
                         v4(),
                         product_id,          // ID del producto
                         userInfo.id,         // ID del vendedor (usuario autenticado)
                         account.information  // Información de la cuenta
                         ], (err) => {
                         if (err) {
                              console.error('Error al insertar la cuenta:', err);
                              return res.status(500).json({ error: `Error al insertar cuenta: ${err.message}` });
                         }
                         });
                         });

                         return res.status(200).json({
                         message: 'Product updated successfully',
                         product: {
                         product_id,
                         title,
                         category,
                         description,
                         price,
                         deliveryUnit,
                         image: imageUrl || req.body.image,
                         }
                         });
                    });
                    });
               });

               } catch (err) {
               console.error('Error al actualizar producto:', err);
               return res.status(500).json({ error: `Server error: ${err.message}` });
               }
          },
          // =============== Get all Products =============== //
          /**
           * Fetches all products from the database.
           */
          getModifyProduct: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }
               const userInfo = jwt.verify(token, process.env.SECRET_KEY);
               const product_id = req.query.e;
               try {
                    const query = `
                         SELECT 
                         title,
                         price,
                         deliveryUnit,
                         delivery_value,
                         image,
                         category,
                         quantity,
                         description
                         FROM Products
                         WHERE user_id = ? AND product_id = ?
                    `;
                    db.query(query, [userInfo.id, product_id], (err, products) => {
                         if (err) {
                         return res.status(500).json({ error: 'Error querying product' });
                         }

                         if (products.length === 0) {
                         return res.status(404).json({ error: 'Product not found' });
                         }

                         const query_account = `
                         SELECT 
                              information, account_id
                         FROM Product_Accounts
                         WHERE product_id = ?
                         `;
                         db.query(query_account, [product_id], (err, accounts) => {
                         if (err) {
                              return res.status(500).json({ error: 'Error querying product accounts' });
                         }

                         const result = {
                              title: products[0].title,
                              price: products[0].price,
                              image: products[0].image,
                              deliveryUnit: products[0].deliveryUnit,
                              delivery_value: products[0].delivery_value,
                              category: products[0].category,
                              quantity: products[0].quantity,
                              description: products[0].description,
                              accounts: accounts
                         };

                         res.status(200).json(result);
                         });
                    });

               } catch (error) {
                    console.error('Error getting products:', error.message);
                    res.status(500).json({ error: 'Error getting products' });
               }
          },

          // =============== Get Products =============== //
          /**
           * Fetches all products from the database.
           */
          getProduct: (req, res) => {
               try {
                    const query = `
                         SELECT 
                         p.product_id,
                         u.user_id,
                         p.title,
                         p.price,
                         p.category,
                         p.quantity,
                         p.image,
                         p.description,
                         u.username AS seller_name,
                         u.rate AS seller_rate 
                         FROM Products p
                         JOIN Users u ON p.user_id = u.user_id
                         WHERE p.quantity > 0;
                    `;

                    db.query(query, (err, products) => {
                         if (err) {
                         return res.status(500).json({ error: 'Error getting products' });
                         }
                         res.status(200).json(products);
                    });

               } catch (error) {
                    console.error('Error getting products:', error.message);
                    res.status(500).json({ error: 'Error getting products' });
               }
          },
          // =============== Get Nav Product =============== //
          /**
           * Get products for the top bar.
           */
          getNav_Product: (req, res) => {    
               const searchTerm = req.query.product; // Obtiene el término de búsqueda
               console.log(searchTerm);
               const sql = `
                    SELECT product_id, title, price, image, category
                    FROM Products 
                    WHERE title LIKE ? AND quantity > 0
                    ORDER BY CHAR_LENGTH(title) - CHAR_LENGTH(REPLACE(title, ?, '')) DESC 
                    LIMIT 10
               `;
               const values = [`%${searchTerm}%`, searchTerm];

               db.query(sql, values, (err, results) => {
                    if (err) {
                         console.error(err);
                         return res.status(500).json({ error: 'Error al realizar la búsqueda' });
                    }
                    res.json(results); // Devuelve los resultados de la búsqueda
               });
          },
          // =============== Get Single Product =============== //
          /**
           * Fetches a single product by its ID.
           */
          getProductById: (req, res) => {
               const product_id = req.query.product_id;
               if (!product_id) {
                    return res.status(400).json({ error: 'Missing product_id in query' });
               }

               try {
                    const query = `
                         SELECT 
                         p.product_id,
                         u.user_id,
                         p.title,
                         p.price,
                         p.category,
                         p.deliveryUnit,
                         p.delivery_value,
                         p.quantity,
                         p.image,
                         p.description,
                         u.username AS seller_name,
                         u.rate AS seller_rate 
                         FROM Products p
                         JOIN Users u ON p.user_id = u.user_id
                         WHERE p.product_id = ? AND p.quantity > 0;
                    `;

                    db.query(query, [product_id], (err, product) => {
                         if (err) {
                         return res.status(500).json({ error: 'Error getting product' });
                         }

                         if (product.length === 0) {
                         return res.status(404).json({ error: 'Product not found' });
                         }

                         res.status(200).json(product[0]);
                    });

               } catch (error) {
                    console.error('Error getting product:', error.message);
                    res.status(500).json({ error: 'Error getting product' });
               }
          },
          // =============== Get Products by User =============== //
          /**
           * Fetches products added by the authenticated user.
           */
          getProductSelf: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               try {
                    const userInfo = jwt.verify(token, process.env.SECRET_KEY);

                    const stmt = `SELECT * FROM Products WHERE user_id = ?`;
                    db.query(stmt, [userInfo.id], (err, products) => {
                         if (err) {
                         console.error('Error getting products:', err.message);
                         return res.status(500).json({ error: 'Error getting products' });
                         }
                         res.status(200).json(products);
                    });

               } catch (error) {
                    console.error('Error getting products:', error.message);
                    res.status(500).json({ error: 'Error getting products' });
               }
          },
          // =============== Get Products by User =============== //
          /**
           * Fetches products added by the authenticated user.
           */
          getProductSelf: (req, res) => {
               const token = req.cookies.session_token;
               if (!token) {
                    return res.status(401).json({ error: 'Unauthorized' });
               }

               try {
                    // Verificamos el token con JWT
                    const userInfo = jwt.verify(token, process.env.SECRET_KEY);

                    // Usamos una consulta SQL con MySQL para obtener los productos
                    const query = 'SELECT * FROM Products WHERE user_id = ?';
                    db.query(query, [userInfo.id], (err, results) => {
                         if (err) {
                         console.error('Error al obtener productos:', err.message);
                         return res.status(500).json({ error: 'Error getting products' });
                         }

                         // Enviamos los productos en la respuesta
                         res.status(200).json(results);
                    });
               } catch (error) {
                    console.error('Error al verificar el token:', error.message);
                    res.status(401).json({ error: 'Invalid token' });
               }
          }
     };
}
