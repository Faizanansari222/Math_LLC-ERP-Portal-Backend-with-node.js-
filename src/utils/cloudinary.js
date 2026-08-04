import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configure once at module load, not on every upload call
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: "mathllc-erp/avatars",
    });

    fs.unlinkSync(localFilePath); // remove temp file after successful upload
    return result;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove temp file even if upload fails
    return null;
  }
};

// public_id is required by cloudinary.uploader.destroy() — it's not the same
// as the URL, so we have to pull it out of the stored URL ourselves.
// Example URL:
// https://res.cloudinary.com/xyz/image/upload/v1699999999/mathllc-erp/avatars/abc123.png
// public_id we need: mathllc-erp/avatars/abc123
const extractPublicId = (cloudinaryUrl) => {
  if (!cloudinaryUrl) return null;
  const afterUpload = cloudinaryUrl.split("/upload/")[1]; // "v169.../folder/name.png"
  if (!afterUpload) return null;
  const withoutVersion = afterUpload.split("/").slice(1).join("/"); // drop "v169..."
  return withoutVersion.replace(/\.[^/.]+$/, ""); // strip extension
};

const deleteFromCloudinary = async (cloudinaryUrl) => {
  try {
    const publicId = extractPublicId(cloudinaryUrl);
    if (!publicId) return null;
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary deletion failed:", error.message);
    return null; // don't let a failed deletion crash the whole request
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };