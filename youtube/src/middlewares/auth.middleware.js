import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from 'jsonwebtoken';

export const verifyJWT = asyncHandler(async (req, _, next) => { // when res is not used so repalce with underscrol (production grade)

    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");


        // If the token is not available
        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        // if the token available
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        // if user is not authenticated
        if (!user) {
            throw new ApiError(401, "invalid access token");
        }

        req.user = user;
        next();
        // this next tells the server to execute the next request defined in the routes ( here we have logout currently in logout routes )
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid access token");
    }
})