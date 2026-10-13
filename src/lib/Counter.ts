import mongoose, { Schema, type Model } from "mongoose";

export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter: Model<ICounter> =
  (mongoose.models.Counter as Model<ICounter>) ||
  mongoose.model<ICounter>("Counter", CounterSchema);

/** Atomically allocates the next permanent fabric ID, e.g. FB-000123. IDs are never reused. */
export async function nextFabricId(): Promise<string> {
  const doc = await Counter.findOneAndUpdate(
    { _id: "fabricId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `FB-${String(doc.seq).padStart(6, "0")}`;
}
