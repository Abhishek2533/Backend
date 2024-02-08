import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import ApiResponse from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';


// genereate tokens
const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        user.save({ validateBeforeSave: false }); // to skip the validations for saving token in DB

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "something went wrong while generating access and refresh token");
    }
};


// register
const registerUser = asyncHandler(async (req, res) => {

    // (1) get user details from frontend
    const { username, fullName, email, password } = req.body;
    // console.log("email", email);


    // (2) validate user details

    // if (fullName === "") {
    //     throw new ApiError(400, "fullname is required");
    // }

    // high level code to check all fields validation at same time
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }


    // (3) check if user already exists in the database: username email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "user with username or email already exists")
    }


    // (4) check for images, check for avatar

    // .files is by default provided by multer
    const avatarLocalPath = await req.files?.avatar[0]?.path;
    // const coverImageLocalPath = await req.files?.coverImage[0]?.path;

    // checking for cover image
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar file is requried");
    }


    // (5) upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "avatar file is required");
    }


    // (6) create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });


    // (7) remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        // -ve sign means do not select,,, by default every field is selected
        "-password -refreshToken"
    );


    // (8) check for user creation
    if (!createdUser) {
        throw new ApiError(500, "semething went wrong while registering the user");
    }

    // (9) return response
    return res.status(201).json(
        new ApiResponse(
            200,
            createdUser,
            "user regsitered successfully"
        )
    )
});


// login
const loginUser = asyncHandler(async (req, res) => {

    // (1) get data from body
    const { email, username, password } = req.body;


    // (2) username or email
    if (!(username && email)) {
        throw new ApiError(400, "username and email is required");
    }

    // if (!username || !email) {
    //     throw new ApiError(400, "username or email is required");
    // }


    // (3) find the user
    const user = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    });

    // if user is not found
    if (!user) {
        throw new ApiError(404, "user does not exist");
    }


    // if user find-
    // (4) password check
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "invalid user credentials");
    }


    // (5) access token and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);


    // (6) send cookies
    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken', refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in successfully"
            )
        )
});


// logout
const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "user logged out"));
});


// endpoint for token to access
const refreshAccessToken = asyncHandler(async (req, res) => {

    // (1) access token from access
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    // (2) verify access token

    // if token not found
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }

    // (2) if found
    const decodedRefreshToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    // (3) get user from token
    const user = await User.findById(decodedRefreshToken?._id);

    // if user not found
    if (!user) {
        throw new ApiError(401, "unauthorized request");
    }

    // verifying user from token - after this every steps will be in trycatch
    try {
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used");
        }

        // (4) generate new access token
        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken
                    },
                    "accessToken refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token");
    }

});


// change current password of user
const changeCurrentPassword = asyncHandler(async (req, res) => {

    // getting password from user
    const { oldPassword, newPassword } = req.body;

    // find user by id to check password
    const user = await User.findById(req.user?._id);

    // validate password is correct or not
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    // if password is not correct
    if (!isPasswordCorrect) {
        throw new ApiError(400, 'Invalid old password');
    }

    // if password iscoorect then update the old password to new password
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    // send response
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            {},
            "password changed successfully"
        ));
});


// get current user
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            200,
            req.user,
            "current user fetched successfully"
        )
});


// update account details
const updateAccountDetails = asyncHandler(async (req, res) => {

    // get current user information
    const { fullName, email } = req.body;

    // if user is not found
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }

    // if user found then update details
    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email,
            },
        },
        { new: true }
    ).select("-password")

    // send response
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "Accoun updated successfully"
        ))
});


// update user avatar
const updateUserAvatar = asyncHandler(async (req, res) => {

    // get avatar from user to local
    const avatarLocalPath = req.file?.path;

    // if not found
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is mising");
    }

    // upload avatar to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    // if url is not find
    if (!avatar) {
        throw new ApiError(400, "Error on uploading avatar");
    }

    // if successfully uploded then 
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    // send response
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "avatar image updated successfully"
        ));
});


// update user coverimage
const updateUserCoverImage = asyncHandler(async (req, res) => {

    // get coverImage from user to local
    const coverImageLocalPath = req.file?.path;

    // if not found
    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImage file is mising");
    }

    // upload coverImage to cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    // if url is not find
    if (!coverImage) {
        throw new ApiError(400, "Error on uploading coverImage");
    }

    // if successfully uploded then 
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    // send response
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "coverImage updated successfully"
        ));
});


// get user channel profile
const getUserChannelProfile = asyncHandler(async (req, res) => {

    // get user channel
    const { username } = req.params;

    // check is available or not
    if (!username?.trim()) {
        throw new ApiError(400, "username is missing");
    }

    // if found
    const channel = await User.aggregate([

        // first pipeline is match - filter document
        {
            $match: {   // from which it have to match - here we need username
                username: username?.toLowerCase()
            }
        },
        // second pipeline is lookup
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscribers",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"   // size is the number of subscribers: "from where we want it",,,  $ is used because it is field now
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    // aggregate will return array

    // if channel is not available
    if (!channel?.length) {
        throw new ApiError(404, "channel does not exist");
    }

    // if channel is available
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            channel[0],
            "User channel fetched successfully"
        ))
});


// get watch history
const getWatchHistory = asyncHandler(async (req, res) => {

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [ // pipeline is used for sub pipeline
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                },
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch History fetched successfully."
        ))
})


export default registerUser;
export {
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};