import mongoose, { Schema, type Model } from "mongoose";

export type FabricStatus = "needs_review" | "draft" | "published";

export interface IFabricImage {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  originalFilename: string;
  originalPath: string; // relative to the import root, forward slashes
  contentHash: string; // sha256 of the original file
}

export interface IFabric {
  fabricId: string;
  name: string;
  description: string;
  category: string; // owner-confirmed category (empty until reviewed)
  suggestedCategory: string; // guessed from the source folder name, never shown publicly
  colors: string[];
  price: number | null; // null => "Enquire for Price"
  currency: "NGN";
  images: IFabricImage[];
  featured: boolean;
  newArrival: boolean; // NOT "isNew": that name is reserved by Mongoose
  status: FabricStatus;
  sourceFolder: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<IFabricImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: Number,
    height: Number,
    format: String,
    bytes: Number,
    originalFilename: { type: String, required: true },
    originalPath: { type: String, required: true },
    contentHash: { type: String, required: true },
  },
  { _id: false }
);

const FabricSchema = new Schema<IFabric>(
  {
    fabricId: { type: String, required: true, unique: true },
    name: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "" },
    suggestedCategory: { type: String, trim: true, default: "" },
    colors: { type: [String], default: [] },
    price: { type: Number, min: 0, default: null },
    currency: { type: String, enum: ["NGN"], default: "NGN" },
    images: { type: [ImageSchema], default: [] },
    featured: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["needs_review", "draft", "published"],
      default: "needs_review",
    },
    sourceFolder: { type: String, default: "" },
  },
  { timestamps: true }
);

// One Cloudinary image can only belong to one fabric record (duplicate protection).
FabricSchema.index({ "images.contentHash": 1 }, { unique: true, sparse: true });
FabricSchema.index({ status: 1, category: 1 });
FabricSchema.index({ name: "text", description: "text", category: "text", colors: "text", fabricId: "text" });

export const Fabric: Model<IFabric> =
  (mongoose.models.Fabric as Model<IFabric>) || mongoose.model<IFabric>("Fabric", FabricSchema);
