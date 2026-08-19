import User from "../models/user.model.js"
import { generateToken } from "../lib/utils.js"
import bcrypt from "bcryptjs"

export const signup = async (req, res) => {
    const { fullName, email, password } = req.body
    try {
        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" })
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be atleast 6 characters" })
        }

        const user = await User.findOne({ email })

        if (user) return res.status(400).json({ message: "user already exists" })

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword
        })

        if (newUser) {
            await newUser.save()
            generateToken(newUser._id, res)

            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
            })
        } else {
            res.status(400).json({ message: "invalid user data" })
        }

    } catch (error) {
        console.log("error in the message controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}

export const login= async(req,res)=>{
    const{email, password} = req.body
    try {
        const user = await User.findOne({email})
        if(!user){
            return res.status(400).json({ message: "invalid credentials"})
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password)
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: "invalid credentials" })
        }

        generateToken(user._id, res)

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email
        })

    } catch (error) {
        console.log("error in the login controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}