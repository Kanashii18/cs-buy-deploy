// routes/seller.routes.js
import express from "express";
import { gestionProduct } from './controllers/seller.product.controller.js';
import { gestionFeedback } from "./controllers/feedback.controller.js";

export default function sellerRouter (db,ci) {
     const router = express.Router();

     
     const { addProduct, 
          getProduct, 
          getProductById, 
          getNav_Product,
          deleteProduct, 
          getProductSelf, 
          getModifyProduct,
          updateProduct } = gestionProduct(db,ci);
     const {
          getFeedback,
          postFeedback,
          getTotalSelled,
          getRecentOrder,
          getAllFeedback
           } = gestionFeedback(db);

     router.post('/set-product', addProduct);
     router.get('/get-product', getProduct);
     router.get('/get-product/top', getNav_Product);
     router.get('/product__page', getProductById);
     router.post("/delete-product", deleteProduct);
     
     router.get('/self-product', getProductSelf);
     router.put('/modify/product', updateProduct);
     router.get('/get-modify', getModifyProduct);

     // Feedback Controller
     router.post('/get-feedback', getFeedback);
     router.get('/all-feedback', getAllFeedback);
     router.post('/set-feedback', postFeedback);
     router.get('/total-selled', getTotalSelled);
     router.get('/order/recent', getRecentOrder);
     return router;
}