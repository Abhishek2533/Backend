// require('dotenv').config({ path: './env' })
// to write dotenv in import we have to use experimental mrthod - not writter here

import dotenv from 'dotenv';



// import mongoose from 'mongoose';
// import { DB_NAME } from './constants';

import connectDB from './db/db.js'
import app from './app.js';


dotenv.config({
    path: './.env'
})

connectDB()
    .then(() => {
        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running at PORT: ${process.env.PORT}`);
        })
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!", err);
    })








/*

import express from 'express'
const app = express();

// iffi methods -> immediately connect to database
(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("ERR: ", error);
            throw error;
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on post ${process.env.PORT}`);
        })

    } catch (error) {
        console.log("ERROR: ", error);
    }
})()

*/