import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema(
  {
    user_id: { type: String, required: true },
    meetingCode: { type: String, required: true }
  },
  {
    timestamps: true   // ⭐ auto creates createdAt
  }
);

const Meeting = mongoose.model("Meeting", meetingSchema);
export { Meeting };
