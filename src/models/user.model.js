import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            trim: true,
            default: "Home"
        },
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        country: {
            type: String,
            required: true,
            trim: true,
            default: "Kenya"
        },
        isDefault: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, "Please provide email"],
            match: [
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
                "Please provide valid email"
            ],
            unique: true,
            lowercase: true,
            trim: true
        },

        fullName: {
            type: String,
            required: [true, "Please provide name"],
            minlength: 5,
            maxlength: 50,
            trim: true
        },

        password: {
            type: String,
            required: function () {
                return !this.googleId;
            },
            minlength: 6
        },

        googleId: {
            type: String,
            default: null,
            unique: true,
            sparse: true
        },

        resetPasswordToken: {
            type: String,
            default: null
        },

        resetPasswordExpires: {
            type: Date,
            default: null
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },
        passwordChangedAt: {
            type: Date,
            default: null
        },
        pendingEmail: {
            type: String,
            default: null
        },
        emailChangeToken: {
            type: String,
            default: null
        },
        emailChangeExpires: {
            type: Date,
            default: null
        },

        
        addresses: [addressSchema]
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", UserSchema);

export default User;