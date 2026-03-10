import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${process.env.DB_NAME}`,
    );
    console.log("DB Connected", connectionInstance.connection.host);
  } catch (error) {
    console.log(error);
  }
};

export default connectDB;
