import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { CLOUDINARY_FOLDER, requireEnv } from "./config";

export function configureCloudinary(): void {
  const env = requireEnv(["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]);
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uploads one file. The public ID is derived from the file hash, so re-running after a
 * crash can never create a second copy of the same image on Cloudinary.
 */
export async function uploadImage(absPath: string, hash: string, attempts = 3): Promise<UploadApiResponse> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await cloudinary.uploader.upload(absPath, {
        folder: CLOUDINARY_FOLDER,
        public_id: hash.slice(0, 24),
        overwrite: false,
        resource_type: "image",
        use_filename: false,
        unique_filename: false,
      });
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await sleep(1000 * 2 ** i);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(JSON.stringify(lastError));
}
