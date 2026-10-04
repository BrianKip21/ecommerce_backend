import mongoose from "mongoose"

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'please provide email'],
        match: [
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            'Please provide valid email'
        ],
        unique: true
    },
    fullName: {
        type: String,
        required: [true, 'please provide name'],
        minlength: 5,
        maxlength: 50,
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId;
        },
        minlength: 6,
    },
    googleId: {
        type: String,
        default: null,
        unique: true,
        sparse: true // allows many documents with googleId: null without violating uniqueness
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    }
},
    { timestamps: true }
)

const User = mongoose.model("User", UserSchema)
export default User;