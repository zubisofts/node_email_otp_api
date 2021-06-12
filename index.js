const express = require('express')
const admin = require("firebase-admin");
const otpGenerator = require('otp-generator')
const nodemailer = require("nodemailer");

require('dotenv').config()

const app = express()
app.use(express.json())

// Referecnce to our firebase app credential file
var serviceAccount = require("./service_account.json");

// Here we initialize our firebase app 
// credentials to link our firebase project
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: 'youremail@gmail.com',
      pass: 'password',
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRETE,
      refreshToken: process.env.REFRESH_TOKEN
    }
  });

// Endpoint to send OTP
app.post('/sendOtp', async(req,res)=>{

// Retrieve email param
const toEmail = req.body.email

// Initiliaze firestore database
const db=admin.firestore()

// Generate OTP code
const code = otpGenerator.generate(6, { upperCase: false, specialChars: false, alphabets: false, digits: true});


// mail options object to send email
let mailOptions = {
    from: 'My App youremail@gmail.com',
    to: toEmail,
    subject: 'OTP To Complete Your Signup',
    html: `<html> <h1>Hi,</h1> <br/><p style="color:grey; font-size:1.2em">Please use the below OTP code to complete your account setup on My App</p><br><br><h1 style="color:orange">${code}</h1></html>`
    };
  
// Now try sending the otp email
try{

    // 2 minutes
    var expiryDate=Date.now()+180000
    
    console.log(`DATE: ${expiryDate}`)

    try{
       await transporter.sendMail(mailOptions)
       await db.collection("otps").doc(toEmail).set({
                email:toEmail,
                otp:code,
                expiry: expiryDate
            })
            return res.json({
                status:"success",
                message:"OTP has been sent to the provided email."
            })
    }catch(e){
        console.log(e)
        return res.json({status:"failed", message:"Unable to send email at the momment"})
    }
    

}catch(error){
    return res.json({
        status:"failed",
        message:`Unknown error occured:${error}`
    })
}

})

app.post('/verifyOTP', async(req,res)=>{

    // Firestore database initialization
    const db=admin.firestore()

    // Retrieve email and OTP from request object
    const email = req.body.email
    const otp = req.body.otp

    // Retrieve the OTP details from the database
    const emailOtp = await db.collection("otps").doc(email).get()

    // Check if this record exists and proceed
    if(emailOtp.exists){

        // Retrieve the expiry date
        const date = emailOtp.data().expiry

        // Check if OTP has expired
        if(Date.now() > date){
            return res.json({status:"failed", message:"Sorry this otp has expired!"})
        }else{
            // Retrieve OTP code from database
            const rOtp= emailOtp.data().otp

            // Compare OTP for match
            if(otp == rOtp){
                return res.json({status:"success", message:"OTP successfully confirmed!"})
            }

            return res.json({status:"failed", message:"Sorry, the otp provided is not valid"})
        }
    }

return res.json({status:"failed", message:"OTP can not be verified at the moment!"})

})

// An endpoint to test our api
app.get('/home', (req, res)=>{
    return res.send('Welcome to our email OTP API')
})


const PORT = process.env.PORT || 3000

app.listen(PORT, ()=>{
    console.log(`Listening to port ${PORT}`)
})