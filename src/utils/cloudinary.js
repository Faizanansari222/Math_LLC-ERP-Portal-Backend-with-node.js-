import cloudinary from "cloudinary";

const uploadOnCloudinary = async (localFilePath) => {
    try{
        if(!localFilePath) return null
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        const result = await cloudinary.uploader.upload(localFilePath,{
            resource_type: "auto",
        });
        return result;

    }catch(error){
        fs.unLinkSync (localFilePath)
        return null
    }
};


export { uploadOnCloudinary }