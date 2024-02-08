import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';    // by default comes with node

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null

        // upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })

        // after file uploaded successfully
        // console.log("file is upoaded on cloudinary", response.url);
        fs.unlinkSync(localFilePath);  // delete local copy of the image

        return response;
    } catch (error) {
        // if file not uploaded successfully
        fs.unlinkSync(localFilePath)    // remove the locally saved temporary file as the upload operation failed

        return null;
    }
}


export default uploadOnCloudinary;