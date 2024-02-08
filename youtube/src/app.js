import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const app = express();

// .use is used for middlewares... and more configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({ limit: "16kb" }));

// url encoded change the url according to the need
app.use(express.urlencoded({
    extended: true, // it helps to give more nested objects if needed
    limit: "16kb"
}));

// static is used for public access like assests, images, etc..
app.use(express.static("public"));

// it helps in cookies crud operations
app.use(cookieParser())


// routes import
import userRouter from './routes/user.routes.js'


//routes declaration
app.use("/api/v1/users", userRouter);   // http://localhost:8000/api/v1/users/register

export default app;