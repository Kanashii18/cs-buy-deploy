// routes/seller.routes.js
import express from "express";
import { purchasedController } from './controllers/order.controller.js';

export default function orderRouter (db) {
     const router = express.Router();

     
     const { get_purchased_by_user, get_specific_product, confirm_product } = purchasedController(db);

     router.get('/list', get_purchased_by_user);
     router.get('/product',get_specific_product);
     router.put('/confirm-product', confirm_product);
     return router;
}